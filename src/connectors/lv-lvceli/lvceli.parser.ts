import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { lvceliRowSchema, type LvceliRow } from "./lvceli.types.js";

export function parseLvceliJson(body: string): ParseOutput<LvceliRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const html = extractBodyHtml(body);
  const table = findRegistryTable(html);
  if (!table) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "LVCELI_TABLE_NOT_FOUND",
          message: "Latvian IDRO registry table was not found in the Drupal JSON body.",
        },
      ],
    };
  }

  const records: LvceliRow[] = [];
  for (const [index, rowMatch] of matchAll(table, /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi).entries()) {
    const cells = matchAll(rowMatch[1] ?? "", /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi).map((match) =>
      htmlText(match[1] ?? ""),
    );
    if (cells.length === 0 || cells[0] === "Name of legal entity") continue;
    if (cells.length !== 5) {
      errors.push({
        severity: "error",
        code: "LVCELI_MALFORMED_ROW",
        message: `Latvian IDRO row ${index + 1} has ${cells.length} columns instead of 5.`,
      });
      continue;
    }

    const record = lvceliRowSchema.safeParse({
      legalEntityName: cells[0],
      cpoIds: parseIdentifierList(cells[1]),
      emspIds: parseIdentifierList(cells[2]),
      email: clean(cells[3]),
      website: normalizeWebsite(cells[4]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "LVCELI_MALFORMED_ROW",
        message: `Latvian IDRO row ${index + 1} is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  return { records, warnings, errors };
}

function extractBodyHtml(body: string) {
  const parsed = JSON.parse(body) as { body?: Array<{ value?: string }> };
  return parsed.body?.[0]?.value ?? "";
}

function findRegistryTable(body: string) {
  return (
    matchAll(body, /<table\b[^>]*>[\s\S]*?<\/table>/gi)
      .map((match) => match[0] ?? "")
      .find(
        (table) =>
          table.includes("Name of legal entity") && table.includes("CPO") && table.includes("MSP"),
      ) ?? null
  );
}

function parseIdentifierList(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*[;,|]\s*/)
    .map((item) => item.replace(/\s+/g, ""))
    .map(clean)
    .filter((item): item is string => item !== null);
}

function normalizeWebsite(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
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
    .replace(/&ldquo;|&rdquo;/gi, '"');
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchAll(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)];
}
