import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { TiiConnector } from "../../src/connectors/ie-tii/tii.connector.js";
import { parseTiiSnapshot } from "../../src/connectors/ie-tii/tii.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("TII parser", () => {
  it("parses the captured public register fixture", async () => {
    const body = await readFile("tests/fixtures/ie-tii/idro-public-register.json", "utf8");
    const result = await parseTiiSnapshot(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(5);
    expect(result.records[1]).toMatchObject({
      legalEntityName: "Blink Charge Ireland Ltd",
      tradingName: "Blink Charging",
      idroIssuedPartyId: "IEBLK",
      isCpo: true,
      isEmsp: true,
    });
    expect(result.records[2]?.ocpiPartyIds).toEqual(["IEEGO"]);
    expect(result.records[3]).toMatchObject({
      legalEntityName: "Source EV Ireland Limited",
      tradingName: "Source EV Ireland Limited",
    });
  });

  it("normalizes CPO and EMSP rows", async () => {
    const source = await loadSourceDefinition("ie-tii");
    const connector = new TiiConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          legalEntityName: "Blink Charge Ireland Ltd",
          tradingName: "Blink Charging",
          idroIssuedPartyId: "IEBLK",
          ocpiPartyIds: [],
          isCpo: true,
          isEmsp: true,
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "ie-tii:IE:BLK:CPO",
      "ie-tii:IE:BLK:EMSP",
    ]);
  });
});
