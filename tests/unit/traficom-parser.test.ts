import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { TraficomConnector } from "../../src/connectors/fi-traficom/traficom.connector.js";
import { parseTraficomHtml } from "../../src/connectors/fi-traficom/traficom.parser.js";
import type { TraficomHtmlRow } from "../../src/connectors/fi-traficom/traficom.types.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

const EXPECTED_TRAFICOM_ROWS: TraficomHtmlRow[] = [
  {
    companyName: "Suomen Osuuskauppojen Keskuskunta",
    cpoIds: ["FI ABC"],
    emspIds: ["FI ABC"],
    businessId: "0116323-1",
  },
  {
    companyName: "IGL-Technologies Oy",
    cpoIds: ["FI EPA"],
    emspIds: ["FI EPA"],
    businessId: "2304284-4",
  },
  {
    companyName: "Helen Oy",
    cpoIds: ["FI HLN"],
    emspIds: ["FI HLN"],
    businessId: "2630573-4",
  },
  {
    companyName: "K Auto Oy",
    cpoIds: ["FI KCH"],
    emspIds: ["FI KCH"],
    businessId: "0154578-2",
  },
  {
    companyName: "PLUGIT FINLAND OY",
    cpoIds: ["FI PLG"],
    emspIds: ["FI PLG"],
    businessId: "2513960-7",
  },
  {
    companyName: "Recharge Finland Oy",
    cpoIds: ["FI REC"],
    emspIds: ["FI REC"],
    businessId: "3104648-2",
  },
  {
    companyName: "Recharge Finland Oy",
    cpoIds: ["FI CHA"],
    emspIds: ["FI CHA"],
    businessId: "3104648-2",
  },
  {
    companyName: "Neste Markkinointi Oy",
    cpoIds: ["FI NES"],
    emspIds: ["FI NES"],
    businessId: "1626490-8",
  },
  {
    companyName: "Liikennevirta Oy",
    cpoIds: ["FI VIR"],
    emspIds: ["FI VIR"],
    businessId: "2588986-2",
  },
  {
    companyName: "Liikennevirta Oy",
    cpoIds: ["FI 001"],
    emspIds: ["FI 001"],
    businessId: "2588986-2",
  },
  {
    companyName: "Liikennevirta Oy",
    cpoIds: ["FI FIN"],
    emspIds: ["FI FIN"],
    businessId: "2588986-2",
  },
  {
    companyName: "EV Assistance Oy",
    cpoIds: ["FI EVM"],
    emspIds: ["FI EVM"],
    businessId: "3407761-2",
  },
  {
    companyName: "Wattery Oy",
    cpoIds: ["FI WTY"],
    emspIds: ["FI WTY"],
    businessId: "3421963-3",
  },
  {
    companyName: "St1 Suomi Oy",
    cpoIds: ["FI ST1"],
    emspIds: ["FI ST1"],
    businessId: "0201124-8",
  },
  {
    companyName: "Wolttinen Oy",
    cpoIds: ["FI WLT"],
    emspIds: [],
    businessId: "2655749-9",
  },
  {
    companyName: "GemCharge Oy",
    cpoIds: ["FI GEM"],
    emspIds: ["FI GEM"],
    businessId: "3592284-9",
  },
  {
    companyName: "Roadster Finland Oy (Tesla)",
    cpoIds: ["FI TSL"],
    emspIds: [],
    businessId: "2644975-4",
  },
  {
    companyName: "Kärkkäinen Oy",
    cpoIds: ["FI KAR"],
    emspIds: [],
    businessId: "0865108-6",
  },
  {
    companyName: "Evenli Oy",
    cpoIds: ["FI EVE"],
    emspIds: [],
    businessId: "3425599-2",
  },
  {
    companyName: "Leppäkoski Group Oy",
    cpoIds: ["FI LEP"],
    emspIds: [],
    businessId: "0133023-9",
  },
  {
    companyName: "Korttelilataus Oy",
    cpoIds: ["FI KRT"],
    emspIds: [],
    businessId: "3243559-4",
  },
  {
    companyName: "Aimo Park Finland Oy",
    cpoIds: ["FI AIM"],
    emspIds: ["FI AIM"],
    businessId: "2208141-1",
  },
  {
    companyName: "VTT Oy",
    cpoIds: ["FI VTT"],
    emspIds: ["FI VTT"],
    businessId: "2647375-4",
  },
  {
    companyName: "Lidl Suomi Kommandiittiyhtiö",
    cpoIds: ["FI LDL"],
    emspIds: ["FI LDL"],
    businessId: "1615779-0",
  },
  {
    companyName: "Oyj Ahola Transport Abp",
    cpoIds: ["FI AHO"],
    emspIds: [],
    businessId: "2255397-6",
  },
  {
    companyName: "BYD Finland Oy",
    cpoIds: ["FI BYD"],
    emspIds: ["FI BYD"],
    businessId: "2155297-1",
  },
];

describe("Traficom parser", () => {
  it("parses every official assignment from the 2026-07-25 HTML fixture", async () => {
    const body = await readFile("tests/fixtures/fi-traficom/issued-codes.html", "utf8");
    const result = parseTraficomHtml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toEqual(EXPECTED_TRAFICOM_ROWS);
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
    expect(result.records[0]?.source.sourceUrl).toBe(source.registryUrl);
  });

  it("reports rows that do not expose the four expected columns", () => {
    const result = parseTraficomHtml(
      [
        "<table><thead><tr>",
        "<th>Issued CPO ID</th><th>Issued MSP ID</th><th>FI business ID (if available)</th>",
        "</tr></thead><tbody>",
        "<tr><td>Helen Oy</td><td>FI HLN</td><td>2630573-4</td></tr>",
        "</tbody></table>",
      ].join(""),
    );

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("TRAFICOM_MALFORMED_ROW");
  });

  it("warns and skips identifiers already issued for the same role", async () => {
    const source = await loadSourceDefinition("fi-traficom");
    const connector = new TraficomConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Helen Oy",
          cpoIds: ["FI HLN"],
          emspIds: ["FI HLN"],
          businessId: "2630573-4",
        },
        {
          companyName: "Helen Oy",
          cpoIds: ["FI-HLN"],
          emspIds: ["FI HLN"],
          businessId: "2630573-4",
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "fi-traficom:FI:HLN:CPO",
      "fi-traficom:FI:HLN:EMSP",
    ]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "TRAFICOM_DUPLICATE_IDENTIFIER",
      "TRAFICOM_DUPLICATE_IDENTIFIER",
    ]);
  });

  it("normalizes all 45 official assignments and excludes observed IDs", async () => {
    const body = await readFile("tests/fixtures/fi-traficom/issued-codes.html", "utf8");
    const parsed = parseTraficomHtml(body);
    const source = await loadSourceDefinition("fi-traficom");
    const connector = new TraficomConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-07-25T00:00:00.000Z",
      records: parsed.records as TraficomHtmlRow[],
    });
    const expected = EXPECTED_TRAFICOM_ROWS.flatMap((row) => [
      ...row.cpoIds.map((identifier) => ({
        organization: row.companyName,
        role: "CPO",
        eMobilityId: identifier.replaceAll(" ", ""),
      })),
      ...row.emspIds.map((identifier) => ({
        organization: row.companyName,
        role: "EMSP",
        eMobilityId: identifier.replaceAll(" ", ""),
      })),
    ]);

    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.records).toHaveLength(45);
    expect(
      result.records.map((record) => ({
        organization: record.organization.name,
        role: record.role,
        eMobilityId: record.eMobilityId,
      })),
    ).toEqual(expected);
    expect(result.records.some((record) => record.organization.name === "Allego Charging Oy")).toBe(
      false,
    );
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
