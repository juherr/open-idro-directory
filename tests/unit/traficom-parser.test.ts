import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { TraficomConnector } from "../../src/connectors/fi-traficom/traficom.connector.js";
import { parseTraficomHtml } from "../../src/connectors/fi-traficom/traficom.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Traficom parser", () => {
  it("parses the captured HTML fixture", async () => {
    const body = await readFile("tests/fixtures/fi-traficom/issued-codes.html", "utf8");
    const result = parseTraficomHtml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      companyName: "Suomen Osuuskauppojen Keskuskunta",
      cpoIds: ["FI ABC"],
      emspIds: ["FI ABC"],
      businessId: "0116323-1",
    });
    expect(result.records[1]?.emspIds).toEqual([]);
  });

  it("parses escaped Traficom table HTML from hydration data", () => {
    const body = String.raw`"\u003ctable\u003e\u003cthead\u003e\u003ctr\u003e\u003cth\u003eIssued CPO ID\u003c/th\u003e\u003cth\u003eIssued MSP ID\u003c/th\u003e\u003cth\u003eFI business ID (if available)\u003c/th\u003e\u003c/tr\u003e\u003c/thead\u003e\u003ctbody\u003e\u003ctr\u003e\u003ctd\u003eHelen Oy\u003c/td\u003e\u003ctd\u003eFI HLN\u003c/td\u003e\u003ctd\u003eFI HLN\u003c/td\u003e\u003ctd\u003e2630573-4\u003c/td\u003e\u003c/tr\u003e\u003c/tbody\u003e\u003c/table\u003e"`;
    const result = parseTraficomHtml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records[0]?.companyName).toBe("Helen Oy");
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("fi-traficom");
    const connector = new TraficomConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Suomen Osuuskauppojen Keskuskunta",
          cpoIds: ["FI ABC"],
          emspIds: ["FI ABC"],
          businessId: "0116323-1",
        },
      ],
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.key)).toEqual([
      "fi-traficom:FI:ABC:CPO",
      "fi-traficom:FI:ABC:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["FIABC", "FIABC"]);
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("fi-traficom");
    const connector = new TraficomConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Bad",
          cpoIds: ["FI TOO-LONG"],
          emspIds: [],
          businessId: null,
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("TRAFICOM_MALFORMED_IDENTIFIER");
  });
});
