import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { traficomHtmlRowSchema, type TraficomHtmlRow } from "./traficom.types.js";

export function parseTraficomHtml(body: string): ParseOutput<TraficomHtmlRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const table = findIssuedCodesTable(decodeEscapedHtml(body));
  if (!table) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "TRAFICOM_TABLE_NOT_FOUND",
          message: "Traficom issued identification codes table was not found in the HTML page.",
        },
      ],
    };
  }

  const records: TraficomHtmlRow[] = [];
  for (const [index, rowMatch] of matchAll(table, /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi).entries()) {
    const rowHtml = rowMatch[1] ?? "";
    const cells = matchAll(rowHtml, /<td\b[^>]*>([\s\S]*?)<\/td>/gi).map((match) =>
      htmlText(match[1] ?? ""),
    );
    if (cells.length === 0) continue;
    if (cells.length !== 4) {
      errors.push({
        severity: "error",
        code: "TRAFICOM_MALFORMED_ROW",
        message: `Traficom row ${index + 1} has ${cells.length} columns instead of 4.`,
      });
      continue;
    }

    const record = traficomHtmlRowSchema.safeParse({
      companyName: cells[0],
      cpoIds: parseIdentifierList(cells[1]),
      emspIds: parseIdentifierList(cells[2]),
      businessId: clean(cells[3]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "TRAFICOM_MALFORMED_ROW",
        message: `Traficom row ${index + 1} is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  return { records, warnings, errors };
}

function findIssuedCodesTable(body: string) {
  return (
    matchAll(body, /<table\b[^>]*>[\s\S]*?<\/table>/gi)
      .map((match) => match[0] ?? "")
      .find(
        (table) =>
          table.includes("Issued CPO ID") &&
          table.includes("Issued MSP ID") &&
          table.includes("FI business ID"),
      ) ?? null
  );
}

function parseIdentifierList(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*[;,|]\s*/)
    .map(clean)
    .filter((item): item is string => item !== null);
}

function decodeEscapedHtml(value: string) {
  return value
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"');
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
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchAll(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)];
}
