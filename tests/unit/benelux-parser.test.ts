import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { BeneluxIdroConnector } from "../../src/connectors/benelux-idro/benelux.connector.js";
import { parseBeneluxCsv } from "../../src/connectors/benelux-idro/benelux.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Benelux IDRO parser", () => {
  it("parses the captured CSV fixture", async () => {
    const body = await readFile("tests/fixtures/benelux-idro/id-register-export.csv", "utf8");
    const result = parseBeneluxCsv(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      companyName: "50five BV",
      cpoIds: ["BE*505", "NL*505", "LU*505"],
      emspIds: ["BE-505", "NL-505", "LU-505"],
      website: "www.50five.com",
    });
  });

  it("reports unexpected headers", () => {
    const result = parseBeneluxCsv("Name,CPO,MSP,Website\nBad,BE*BAD,,example.com\n");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("BENELUX_UNEXPECTED_HEADERS");
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("benelux-idro");
    const connector = new BeneluxIdroConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      records: [
        {
          companyName: "50five BV",
          cpoIds: ["BE*505", "NL*505"],
          emspIds: ["BE-505"],
          website: "www.50five.com",
        },
      ],
    });

    expect(result.records).toHaveLength(3);
    expect(result.records.map((record) => record.key)).toEqual([
      "benelux-idro:BE:505:CPO",
      "benelux-idro:NL:505:CPO",
      "benelux-idro:BE:505:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["BE505", "NL505", "BE505"]);
    expect(result.records[0]?.organization.website).toBe("https://www.50five.com/");
    expect(result.records[0]?.source.sourceUrl).toBe(
      "https://www.benelux-idro.eu/en/id-register/export",
    );
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("benelux-idro");
    const connector = new BeneluxIdroConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      records: [
        {
          companyName: "Bad",
          cpoIds: ["BE*TOO-LONG"],
          emspIds: [],
          website: null,
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("BENELUX_MALFORMED_IDENTIFIER");
  });
});
