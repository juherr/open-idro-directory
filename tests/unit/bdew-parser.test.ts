import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { BdewConnector } from "../../src/connectors/de-bdew/bdew.connector.js";
import { parseBdewJson } from "../../src/connectors/de-bdew/bdew.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("BDEW parser", () => {
  it("parses the captured JSON fixture", async () => {
    const body = await readFile("tests/fixtures/de-bdew/active-codes.json", "utf8");
    const result = parseBdewJson(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records[0]?.cpo).toHaveLength(2);
    expect(result.records[0]?.emsp).toHaveLength(2);
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("de-bdew");
    const connector = new BdewConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          cpo: [{ Id: 36164, Code: "DE NOM", Company: "\tNortheimer Sport und Freizeit GmbH" }],
          emsp: [{ Id: 36163, Code: "DE NOM", Company: "\tNortheimer Sport und Freizeit GmbH" }],
        },
      ],
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.key)).toEqual([
      "de-bdew:DE:NOM:CPO",
      "de-bdew:DE:NOM:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["DENOM", "DENOM"]);
    expect(result.records.map((record) => record.source.sourceUrl)).toEqual([
      "https://bdew-codes.de/Codenumbers/EMobilityId/GetActiveCodes?showProviderId=false",
      "https://bdew-codes.de/Codenumbers/EMobilityId/GetActiveCodes?showProviderId=true",
    ]);
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("de-bdew");
    const connector = new BdewConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [{ cpo: [{ Id: 1, Code: "DE TOO-LONG", Company: "Bad" }], emsp: [] }],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("BDEW_MALFORMED_IDENTIFIER");
  });
});
