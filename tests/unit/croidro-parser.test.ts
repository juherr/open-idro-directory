import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CroIdroConnector } from "../../src/connectors/hr-croidro/croidro.connector.js";
import { parseCroIdroCsv } from "../../src/connectors/hr-croidro/croidro.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Croatian IDRO parser", () => {
  it("parses the captured CSV fixture", async () => {
    const body = await readFile("tests/fixtures/hr-croidro/idro-ispis-kodova.csv", "utf8");
    const result = parseCroIdroCsv(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(5);
    expect(result.records[0]).toMatchObject({
      companyName: "Electrip Mobility Service d.o.o.",
      cpoIds: ["HR-ELC"],
      emspIds: ["HR-ELC"],
    });
  });

  it("reports unexpected headers", () => {
    const result = parseCroIdroCsv("Company,CPO,MSP\nBad,HR-BAD,\n");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("CROIDRO_UNEXPECTED_HEADERS");
  });

  it("does not truncate malformed identifiers while parsing", () => {
    const result = parseCroIdroCsv("Naziv tvrtke/osobe,CPO ID,MSP ID\nBad,HR-TOO-LONG,\n");

    expect(result.errors).toHaveLength(0);
    expect(result.records[0]?.cpoIds).toEqual(["HR-TOO-LONG"]);
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("hr-croidro");
    const connector = new CroIdroConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Sunčani auto park Zagreb d.o.o.",
          cpoIds: ["HR-SAP"],
          emspIds: ["HR-001"],
        },
      ],
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.key)).toEqual([
      "hr-croidro:HR:SAP:CPO",
      "hr-croidro:HR:001:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["HRSAP", "HR001"]);
    expect(result.records[0]?.source.sourceUrl).toBe(
      "https://pametnamobilnost.hr/idro/Home/IspisiCSV",
    );
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("hr-croidro");
    const connector = new CroIdroConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Bad",
          cpoIds: ["HR-TOO-LONG"],
          emspIds: [],
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("CROIDRO_MALFORMED_IDENTIFIER");
  });
});
