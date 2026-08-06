import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { SuisseEnergieConnector } from "../../src/connectors/ch-suisseenergie/suisseenergie.connector.js";
import { parseSuisseEnergieHtml } from "../../src/connectors/ch-suisseenergie/suisseenergie.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("SuisseEnergie parser", () => {
  it("parses the captured register page fixture", async () => {
    const body = await readFile("tests/fixtures/ch-suisseenergie/register.html", "utf8");
    const result = parseSuisseEnergieHtml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records[0]).toEqual({
      node_locale: "fr",
      digitId: "CH 2TH",
      CPO: false,
      EMP: true,
      organization: { companyName: "2th Floor Sagl", website: "https://www.2thfloor.ch" },
    });
  });

  it("flattens organizations holding several identifiers", async () => {
    const body = await readFile("tests/fixtures/ch-suisseenergie/register.html", "utf8");
    const result = parseSuisseEnergieHtml(body);

    expect(result.records.map((record) => record.digitId)).toEqual([
      "CH 2TH",
      "CH ONE",
      "CH BKW",
      "CH EBM",
      "CH 360",
    ]);
    // Roles are index-aligned with the identifiers: Energie 360 is EMP for its
    // second identifier only.
    expect(result.records.slice(3).map((record) => record.EMP)).toEqual([false, true]);
  });

  it("reports a page that no longer embeds the register", () => {
    const result = parseSuisseEnergieHtml("<html><body><p>Page introuvable</p></body></html>");

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("SUISSEENERGIE_REGISTER_NOT_FOUND");
  });

  it("reports an island payload that is not readable JSON", () => {
    const result = parseSuisseEnergieHtml(
      '<astro-island props="&quot;frontendElementName&quot;:&quot;DigitIDRegister&quot;"></astro-island>',
    );

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("SUISSEENERGIE_INVALID_PAYLOAD");
  });

  it("skips identifiers whose role flags are missing", () => {
    const props = JSON.stringify({
      fields: [
        0,
        {
          content: [
            0,
            {
              references: [
                1,
                [
                  [
                    0,
                    {
                      frontendElementName: [0, "DigitIDRegister"],
                      node_locale: [0, "fr"],
                      toolData: [
                        0,
                        {
                          providers: [
                            1,
                            [
                              [
                                0,
                                {
                                  company: [0, "Incomplete SA"],
                                  website: [0, null],
                                  ID: [
                                    1,
                                    [
                                      [0, "CH INC"],
                                      [0, "CH OMP"],
                                    ],
                                  ],
                                  CPO: [1, [[0, true]]],
                                  EMP: [1, [[0, true]]],
                                },
                              ],
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                ],
              ],
            },
          ],
        },
      ],
    }).replaceAll('"', "&quot;");
    const result = parseSuisseEnergieHtml(`<astro-island props="${props}"></astro-island>`);

    expect(result.records.map((record) => record.digitId)).toEqual(["CH INC"]);
    expect(result.warnings[0]?.code).toBe("SUISSEENERGIE_MISSING_ROLE_FLAGS");
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
      "https://www.suisseenergie.ch/infrastructure-de-recharge/outils/identifiant-pour-les-cpo-et-les-emp/registre-suisse-des-identifiants/",
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
