import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { SuisseEnergieConnector } from "../../src/connectors/ch-suisseenergie/suisseenergie.connector.js";
import { parseSuisseEnergieJson } from "../../src/connectors/ch-suisseenergie/suisseenergie.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("SuisseEnergie parser", () => {
  it("parses the captured page-data fixture", async () => {
    const body = await readFile("tests/fixtures/ch-suisseenergie/page-data.json", "utf8");
    const result = parseSuisseEnergieJson(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(4);
    expect(result.records[0]).toMatchObject({
      node_locale: "it",
      digitId: "CH MOV",
      CPO: true,
      EMP: false,
    });
  });

  it("normalizes CPO and EMP roles after locale deduplication", async () => {
    const source = await loadSourceDefinition("ch-suisseenergie");
    const connector = new SuisseEnergieConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          node_locale: "it",
          digitId: "CH MOV",
          CPO: true,
          EMP: false,
          organization: { companyName: "MOVE Mobility SA", website: "https://move.ch/" },
        },
        {
          node_locale: "fr",
          digitId: "CH MOV",
          CPO: true,
          EMP: false,
          organization: { companyName: "MOVE Mobility SA", website: "https://move.ch/" },
        },
        {
          node_locale: "fr",
          digitId: "CH ERI",
          CPO: true,
          EMP: true,
          organization: { companyName: "Scania DCS AB", website: "https://erinioncharge.com/" },
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "ch-suisseenergie:CH:MOV:CPO",
      "ch-suisseenergie:CH:ERI:CPO",
      "ch-suisseenergie:CH:ERI:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["CHMOV", "CHERI", "CHERI"]);
    expect(result.records[0]?.metadata.suisseEnergieLocale).toBe("fr");
    expect(result.records[0]?.source.sourceUrl).toBe(
      "https://www.suisseenergie.ch/page-data/sq/d/3887988665.json",
    );
  });

  it("warns and skips identifiers without CPO or EMP role", async () => {
    const source = await loadSourceDefinition("ch-suisseenergie");
    const connector = new SuisseEnergieConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          node_locale: "fr",
          digitId: "CH BFE",
          CPO: false,
          EMP: false,
          organization: {
            companyName: "Bundesamt fur Energie (BFE)",
            website: "https://www.energieschweiz.ch/",
          },
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("SUISSEENERGIE_IDENTIFIER_WITHOUT_ROLE");
  });
});
