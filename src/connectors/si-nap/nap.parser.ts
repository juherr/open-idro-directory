import { strFromU8, unzipSync } from "fflate";
import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { napRowSchema, type NapRow } from "./nap.types.js";

const EXPECTED_HEADERS = ["Naziv", "MSP ID koda", "CPO ID koda"];

export function parseNapSnapshot(body: string): ParseOutput<NapRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const parsed = JSON.parse(body) as { contentBase64?: string };
  if (typeof parsed.contentBase64 !== "string") {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "NAP_INVALID_SNAPSHOT",
          message: "Slovenian NAP snapshot is missing contentBase64.",
        },
      ],
    };
  }

  const rows = workbookRows(Buffer.from(parsed.contentBase64, "base64"));
  const headers = rows.find((row) => row[0] === EXPECTED_HEADERS[0]);
  if (!headers || !EXPECTED_HEADERS.every((header, index) => headers[index] === header)) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "NAP_UNEXPECTED_HEADERS",
          message: `Unexpected Slovenian NAP workbook headers: ${(headers ?? []).join(", ")}`,
        },
      ],
    };
  }

  const records: NapRow[] = [];
  for (const row of rows.slice(rows.indexOf(headers) + 1)) {
    if (!clean(row[0])) continue;
    const record = napRowSchema.safeParse({
      organizationName: row[0],
      emspId: clean(row[1]),
      cpoId: clean(row[2]),
      address: clean([row[3], row[4]].filter(Boolean).join(" ")),
      city: clean(row[6]),
      country: clean(row[7]),
      website: clean(row[10]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "NAP_MALFORMED_ROW",
        message: `Slovenian NAP row is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  if (records.length === 0) {
    errors.push({
      severity: "error",
      code: "NAP_NO_RECORDS",
      message: "Slovenian NAP workbook did not contain parseable records.",
    });
  }

  return { records, warnings, errors };
}

function workbookRows(content: Buffer) {
  const files = unzipSync(new Uint8Array(content));
  const sharedStringsXml = readZipText(files, "xl/sharedStrings.xml");
  const sheetXml = readZipText(files, "xl/worksheets/sheet1.xml");
  const sharedStrings = [...sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...(match[1] ?? "").matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)]
        .map((textMatch) => textMatch[1] ?? "")
        .join(""),
    ),
  );

  return [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const cells: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(
      /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g,
    )) {
      const attributes = cellMatch[1] ?? cellMatch[3] ?? "";
      const columnIndex = columnToIndex(/r="([A-Z]+)\d+"/.exec(attributes)?.[1] ?? "A");
      while (cells.length < columnIndex) cells.push("");
      const value = /<v>([\s\S]*?)<\/v>/.exec(cellMatch[2] ?? "")?.[1];
      cells[columnIndex] =
        attributes.includes('t="s"') && value !== undefined
          ? (sharedStrings[Number(value)] ?? "")
          : decodeXml(value ?? "");
    }
    return cells;
  });
}

function readZipText(files: Record<string, Uint8Array>, path: string) {
  const file = files[path];
  if (!file) throw new Error(`Missing ${path} in Slovenian NAP workbook.`);
  return strFromU8(file);
}

function columnToIndex(column: string) {
  let index = 0;
  for (let position = 0; position < column.length; position++) {
    index = index * 26 + column.charCodeAt(position) - 64;
  }
  return index - 1;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
