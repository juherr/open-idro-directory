import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  assertEnergimyndighetenWorkbook,
  EnergimyndighetenConnector,
  energimyndighetenWorkbookUrls,
  findEnergimyndighetenEmspWorkbookUrl,
} from "../../src/connectors/se-energimyndigheten/energimyndigheten.connector.js";
import { parseEnergimyndighetenSnapshot } from "../../src/connectors/se-energimyndigheten/energimyndigheten.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

const CPO_URL =
  "https://www.energimyndigheten.se/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx";
const EMSP_URL =
  "https://www.energimyndigheten.se/globalassets/klimat/laddinfrastruktur/register-for-emsp-2026.xlsx";
const LANDING_PAGE_FIXTURE = "tests/fixtures/se-energimyndigheten/idro-landing-page-2026-10.html";

describe("Swedish Energy Agency workbook URLs", () => {
  const landingPageUrl =
    "https://www.energimyndigheten.se/klimat/transporter/laddinfrastruktur/identification-registration-organisation-idro/";

  it("takes the CPO workbook from the source descriptor", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const landingPage = await readFile(LANDING_PAGE_FIXTURE, "utf8");

    expect(energimyndighetenWorkbookUrls(source, landingPage).cpo).toBe(source.registry.url);
  });

  // The EMSP workbook went from `register-for-emsp.xlsx` to
  // `register-for-emsp-2026.xlsx` in October 2026: only the landing page knows
  // its current name.
  it("finds the EMSP workbook linked from the landing page", async () => {
    const landingPage = await readFile(LANDING_PAGE_FIXTURE, "utf8");

    expect(findEnergimyndighetenEmspWorkbookUrl(landingPage, landingPageUrl)).toBe(
      "https://www.energimyndigheten.se/globalassets/klimat/laddinfrastruktur/register-for-emsp-2026.xlsx",
    );
  });

  it("reports a landing page that no longer links an EMSP workbook", () => {
    expect(() =>
      findEnergimyndighetenEmspWorkbookUrl(
        '<p><a href="/4a842b/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx">CPO</a></p>',
        landingPageUrl,
      ),
    ).toThrow(/EMSP workbook link/);
  });

  // The register page rewrites the asset hash on every upload, so a URL that
  // carries one is a URL that will stop matching the page it was copied from.
  it("pins both workbooks to the path that outlives the rotating asset hash", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const landingPage = await readFile(LANDING_PAGE_FIXTURE, "utf8");
    const urls = energimyndighetenWorkbookUrls(source, landingPage);

    for (const url of [urls.cpo, urls.emsp]) {
      expect(new URL(url).pathname).toMatch(/^\/globalassets\//);
    }
  });
});

describe("Swedish Energy Agency workbook download", () => {
  it("accepts an XLSX workbook", () => {
    expect(() =>
      assertEnergimyndighetenWorkbook(Buffer.from(workbookBase64([["ID"]]), "base64"), EMSP_URL),
    ).not.toThrow();
  });

  // A removed workbook is answered with the site's HTML 404 page and status
  // 200, which the XLSX reader then rejects without saying where it came from.
  it("names the URL when a workbook URL serves something else", () => {
    expect(() =>
      assertEnergimyndighetenWorkbook(Buffer.from("<!DOCTYPE html><html></html>"), EMSP_URL),
    ).toThrow(`${EMSP_URL} did not return an XLSX workbook`);
  });
});

describe("Swedish Energy Agency parser", () => {
  it("parses CPO and EMSP workbook snapshots", async () => {
    const fixture = JSON.parse(
      await readFile("tests/fixtures/se-energimyndigheten/workbook-rows.json", "utf8"),
    ) as { cpo: unknown[][]; emsp: unknown[][] };
    const result = await parseEnergimyndighetenSnapshot(
      JSON.stringify({
        cpo: {
          url: CPO_URL,
          contentBase64: workbookBase64(fixture.cpo),
        },
        emsp: {
          url: EMSP_URL,
          contentBase64: workbookBase64(fixture.emsp),
        },
      }),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.records).toEqual([
      { sourceValue: "SE*AIM", organizationName: "Aimo Charge", role: "CPO", sourceUrl: CPO_URL },
      {
        sourceValue: "SEWXYZ",
        organizationName: "Example Operator",
        role: "CPO",
        sourceUrl: CPO_URL,
      },
      { sourceValue: "SE*ESP", organizationName: "EasyPark", role: "EMSP", sourceUrl: EMSP_URL },
    ]);
  });

  it("parses Swedish CPO workbooks with operator-first headers", async () => {
    const result = await parseEnergimyndighetenSnapshot(
      JSON.stringify({
        cpo: {
          url: CPO_URL,
          contentBase64: workbookBase64([
            ["Operator", "CPO-ID"],
            ["Aimo Charge", "SE*AIM"],
          ]),
        },
        emsp: {
          url: EMSP_URL,
          contentBase64: workbookBase64([["ID", "Operator"]]),
        },
      }),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.records).toEqual([
      { sourceValue: "SE*AIM", organizationName: "Aimo Charge", role: "CPO", sourceUrl: CPO_URL },
    ]);
  });

  it("normalizes Swedish CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const connector = new EnergimyndighetenConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        { sourceValue: "SE*AIM", organizationName: "Aimo Charge", role: "CPO", sourceUrl: CPO_URL },
        { sourceValue: "SE*ESP", organizationName: "EasyPark", role: "EMSP", sourceUrl: EMSP_URL },
        {
          sourceValue: "SEWXYZ",
          organizationName: "Example Operator",
          role: "CPO",
          sourceUrl: CPO_URL,
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "se-energimyndigheten:SE:AIM:CPO",
      "se-energimyndigheten:SE:ESP:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["SEAIM", "SEESP"]);
  });

  it("warns and skips party IDs that are not exactly three characters", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const connector = new EnergimyndighetenConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          sourceValue: "SEWXYZ",
          organizationName: "Example Operator",
          role: "CPO",
          sourceUrl: CPO_URL,
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("ENERGIMYNDIGHETEN_MALFORMED_IDENTIFIER");
    expect(result.warnings[0]?.rejectedIdentifier).toBe("SEWXYZ");
  });

  it("warns and skips non-Swedish identifiers", async () => {
    const source = await loadSourceDefinition("se-energimyndigheten");
    const connector = new EnergimyndighetenConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          sourceValue: "SR*ABC",
          organizationName: "Example Operator",
          role: "CPO",
          sourceUrl: CPO_URL,
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    // Well formed, but another country's register administers it: reporting it
    // as unreadable would send a maintainer after a parser bug that is not there.
    expect(result.warnings[0]?.code).toBe("ENERGIMYNDIGHETEN_OUT_OF_JURISDICTION_IDENTIFIER");
    expect(result.warnings[0]?.rejectedIdentifier).toBeUndefined();
  });
});

function workbookBase64(rows: unknown[][]) {
  const files = {
    "_rels/.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "[Content_Types].xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    "xl/_rels/workbook.xml.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    "xl/workbook.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Blad1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/worksheets/sheet1.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows.map(rowXml).join("")}</sheetData>
</worksheet>`),
  };
  return Buffer.from(zipSync(files)).toString("base64");
}

function rowXml(row: unknown[], rowIndex: number) {
  return `<row r="${rowIndex + 1}">${row
    .map((cell, columnIndex) => {
      const reference = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(formatCell(cell))}</t></is></c>`;
    })
    .join("")}</row>`;
}

function xml(value: string) {
  return strToU8(value);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
