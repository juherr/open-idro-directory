import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { croIdroHtmlRowSchema, type CroIdroHtmlRow } from "./croidro.types.js";

const COMPANY_HEADERS = new Set(["Naziv tvrtke / osobe", "Naziv tvrtke/osobe"]);
const IDENTIFIER_HEADERS = ["CPO ID", "MSP ID"];
const COLUMN_COUNT = 1 + IDENTIFIER_HEADERS.length;

export function parseCroIdroHtml(body: string): ParseOutput<CroIdroHtmlRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const table = findRegistryTable(body);
  if (!table) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "CROIDRO_TABLE_NOT_FOUND",
          message: "Croatian IDRO registry table was not found in the search page.",
        },
      ],
    };
  }

  const rows = matchAll(table, /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi).map((match) => match[1] ?? "");
  const headers = rows.flatMap((row) =>
    matchAll(row, /<th\b[^>]*>([\s\S]*?)<\/th>/gi).map((match) => htmlText(match[1] ?? "")),
  );
  if (!hasExpectedHeaders(headers)) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "CROIDRO_UNEXPECTED_HEADERS",
          message: `Unexpected Croatian IDRO table headers: ${headers.join(", ")}`,
        },
      ],
    };
  }

  const records: CroIdroHtmlRow[] = [];
  let dataRows = 0;
  for (const [index, rowHtml] of rows.entries()) {
    const cells = matchAll(rowHtml, /<td\b[^>]*>([\s\S]*?)<\/td>/gi).map((match) =>
      htmlText(match[1] ?? ""),
    );
    if (cells.length === 0) continue;
    dataRows++;
    if (cells.length !== COLUMN_COUNT) {
      errors.push({
        severity: "error",
        code: "CROIDRO_MALFORMED_ROW",
        message: `Croatian IDRO row ${index + 1} has ${cells.length} columns instead of ${COLUMN_COUNT}.`,
      });
      continue;
    }

    const record = croIdroHtmlRowSchema.safeParse({
      companyName: cells[0],
      cpoIds: parseIdentifierList(cells[1]),
      emspIds: parseIdentifierList(cells[2]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "CROIDRO_MALFORMED_ROW",
        message: `Croatian IDRO row ${index + 1} is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  // The register is not empty: a table without rows means the page did not
  // render it, and publishing that would read as every identifier withdrawn.
  if (dataRows === 0) {
    errors.push({
      severity: "error",
      code: "CROIDRO_EMPTY_TABLE",
      message: "Croatian IDRO registry table has no rows.",
    });
  }

  return { records, warnings, errors };
}

function findRegistryTable(body: string) {
  return (
    matchAll(body, /<table\b[^>]*>[\s\S]*?<\/table>/gi)
      .map((match) => match[0] ?? "")
      .find((table) => IDENTIFIER_HEADERS.every((header) => table.includes(header))) ?? null
  );
}

function hasExpectedHeaders(headers: string[]) {
  return (
    headers.length === COLUMN_COUNT &&
    COMPANY_HEADERS.has(headers[0] ?? "") &&
    IDENTIFIER_HEADERS.every((header, index) => headers[index + 1] === header)
  );
}

function parseIdentifierList(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return [];
  return cleaned
    .split(/[\s;|]+/)
    .map(clean)
    .filter((item): item is string => item !== null);
}

function htmlText(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchAll(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)];
}
