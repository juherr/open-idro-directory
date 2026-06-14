import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { fstyrHtmlRowSchema, type FstyrHtmlRow } from "./fstyr.types.js";

export function parseFstyrHtml(body: string): ParseOutput<FstyrHtmlRow> {
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
          code: "FSTYR_TABLE_NOT_FOUND",
          message: "Danish IDRO registry table was not found in the HTML page.",
        },
      ],
    };
  }

  const records: FstyrHtmlRow[] = [];
  for (const [index, rowMatch] of matchAll(table, /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi).entries()) {
    const rowHtml = rowMatch[1] ?? "";
    const cells = matchAll(rowHtml, /<td\b[^>]*>([\s\S]*?)<\/td>/gi).map((match) =>
      htmlText(match[1] ?? ""),
    );
    if (cells.length === 0) continue;
    if (cells.length !== 4) {
      errors.push({
        severity: "error",
        code: "FSTYR_MALFORMED_ROW",
        message: `Danish IDRO row ${index + 1} has ${cells.length} columns instead of 4.`,
      });
      continue;
    }

    const record = fstyrHtmlRowSchema.safeParse({
      cvr: clean(cells[0]),
      companyName: cells[1],
      cpoIds: parseIdentifierList(cells[2]),
      emspIds: parseIdentifierList(cells[3]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "FSTYR_MALFORMED_ROW",
        message: `Danish IDRO row ${index + 1} is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  return { records, warnings, errors };
}

function findRegistryTable(body: string) {
  return (
    matchAll(body, /<table\b[^>]*>[\s\S]*?<\/table>/gi)
      .map((match) => match[0] ?? "")
      .find(
        (table) =>
          table.includes("Virksomhed") &&
          table.includes("CPO-ID nummer") &&
          table.includes("MSP-ID"),
      ) ?? null
  );
}

function parseIdentifierList(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*[;|]\s*/)
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
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aelig;/gi, "ae")
    .replace(/&AElig;/g, "AE")
    .replace(/&oslash;/gi, "oe")
    .replace(/&Oslash;/g, "OE")
    .replace(/&aring;/gi, "aa")
    .replace(/&Aring;/g, "AA");
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchAll(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)];
}
