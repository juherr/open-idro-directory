import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MobieConnector } from "../../src/connectors/pt-mobie/mobie.connector.js";
import { parseMobieSnapshot } from "../../src/connectors/pt-mobie/mobie.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("MOBI.E parser", () => {
  it("parses the captured PDF text fixture", async () => {
    const body = await readFile("tests/fixtures/pt-mobie/party-id.json", "utf8");
    const result = await parseMobieSnapshot(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toEqual([
      {
        code: "ACOR",
        partyId: "ACR",
        organizationName: "Açorcabos, Telecomunicações e Electricidade, Lda.",
        isEmsp: false,
        isCpo: true,
      },
      {
        code: "BLUE",
        partyId: "BLU",
        organizationName: "Blue Charge",
        isEmsp: true,
        isCpo: true,
      },
      {
        code: "DCSO",
        partyId: "DCS",
        organizationName: "Digital Charging Solutions GMBH",
        isEmsp: true,
        isCpo: true,
      },
    ]);
  });

  it("normalizes Portuguese CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("pt-mobie");
    const connector = new MobieConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          code: "BLUE",
          partyId: "BLU",
          organizationName: "Blue Charge",
          isEmsp: true,
          isCpo: true,
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "pt-mobie:PT:BLU:CPO",
      "pt-mobie:PT:BLU:EMSP",
    ]);
  });
});
