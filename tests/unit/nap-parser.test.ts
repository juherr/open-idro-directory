import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { NapConnector } from "../../src/connectors/si-nap/nap.connector.js";
import { parseNapSnapshot } from "../../src/connectors/si-nap/nap.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Slovenian NAP parser", () => {
  it("parses the captured workbook fixture", async () => {
    const rows = JSON.parse(
      await readFile("tests/fixtures/si-nap/workbook-rows.json", "utf8"),
    ) as string[][];
    const result = parseNapSnapshot(
      JSON.stringify({
        contentBase64: workbookBase64(rows),
      }),
    );

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[1]).toMatchObject({
      organizationName: "MARJETICA KOPER d.o.o.",
      emspId: "SI*011",
      cpoId: "SI*010",
      city: "Koper",
      website: "www.marjeticakoper.si",
    });
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("si-nap");
    const connector = new NapConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          organizationName: "MARJETICA KOPER d.o.o.",
          emspId: "SI*011",
          cpoId: "SI*010",
          address: "Ulica 15. maja 4",
          city: "Koper",
          country: "SI",
          website: "www.marjeticakoper.si",
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "si-nap:SI:010:CPO",
      "si-nap:SI:011:EMSP",
    ]);
    expect(result.records[0]?.organization.website).toBe("https://www.marjeticakoper.si/");
  });
});

function workbookBase64(rows: string[][]) {
  const sharedStrings = [...new Set(rows.flat())];
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
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`),
    "xl/_rels/workbook.xml.rels": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    "xl/workbook.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/sharedStrings.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${rows.flat().length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((value) => `<si><t xml:space="preserve">${escapeXml(value)}</t></si>`).join("")}
</sst>`),
    "xl/worksheets/sheet1.xml": xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1"/>
  <sheetData>${rows.map((row, index) => rowXml(row, index, sharedStrings)).join("")}</sheetData>
</worksheet>`),
  };
  return Buffer.from(zipSync(files)).toString("base64");
}

function rowXml(row: string[], rowIndex: number, sharedStrings: string[]) {
  return `<row r="${rowIndex + 1}">${row
    .map((cell, columnIndex) => {
      const reference = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
      const valueIndex = sharedStrings.indexOf(cell);
      return `<c r="${reference}" t="s"><v>${valueIndex}</v></c>`;
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
