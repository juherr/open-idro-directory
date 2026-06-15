import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { electrokinisiHtmlRowSchema, type ElectrokinisiHtmlRow } from "./electrokinisi.types.js";

export function parseElectrokinisiHtml(body: string): ParseOutput<ElectrokinisiHtmlRow> {
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
          code: "ELECTROKINISI_TABLE_NOT_FOUND",
          message: "Greek IDRO registry table was not found in the HTML page.",
        },
      ],
    };
  }

  const records: ElectrokinisiHtmlRow[] = [];
  for (const [index, rowMatch] of matchAll(table, /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi).entries()) {
    const rowHtml = rowMatch[1] ?? "";
    const cells = matchAll(rowHtml, /<td\b[^>]*>([\s\S]*?)<\/td>/gi).map((match) => match[1] ?? "");
    if (cells.length === 0) continue;
    if (cells.length !== 5) {
      errors.push({
        severity: "error",
        code: "ELECTROKINISI_MALFORMED_ROW",
        message: `Greek IDRO row ${index + 1} has ${cells.length} columns instead of 5.`,
      });
      continue;
    }

    const organizationName = clean(htmlText(cells[1] ?? ""));
    const website = cleanHref(cells[3] ?? "") ?? clean(htmlText(cells[3] ?? ""));
    const email = cleanMailto(cells[4] ?? "") ?? clean(htmlText(cells[4] ?? ""));
    const idCell = cells[2] ?? "";
    for (const identifier of parseIdentifiers(idCell)) {
      const record = electrokinisiHtmlRowSchema.safeParse({
        organizationName,
        sourceValue: identifier.sourceValue,
        sourceRole: identifier.sourceRole,
        role: mapRole(identifier.sourceRole),
        website: normalizeWebsite(website),
        email,
      });
      if (!record.success) {
        errors.push({
          severity: "error",
          code: "ELECTROKINISI_MALFORMED_IDENTIFIER",
          message: `Greek IDRO row ${index + 1} identifier is malformed: ${record.error.message}`,
        });
        continue;
      }
      records.push(record.data);
    }
  }

  return { records, warnings, errors };
}

function findRegistryTable(body: string) {
  return (
    matchAll(body, /<table\b[^>]*>[\s\S]*?<\/table>/gi)
      .map((match) => match[0] ?? "")
      .find(
        (table) =>
          table.includes("Company Name") &&
          table.includes("Assigned ID") &&
          table.includes("u-table-entity"),
      ) ?? null
  );
}

function parseIdentifiers(cellHtml: string) {
  const ids = matchAll(
    cellHtml,
    /<span\b[^>]*class="[^"]*\btext-bold\b[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*class="[^"]*\btext-sm\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
  );
  return ids
    .map((match) => ({
      sourceValue: htmlText(match[1] ?? ""),
      sourceRole: htmlText(match[2] ?? ""),
    }))
    .filter((identifier) => identifier.sourceValue.length > 0);
}

function mapRole(sourceRole: string) {
  switch (sourceRole) {
    case "Φ.Ε.Υ.Φ.Η.Ο.":
      return "CPO" as const;
    case "Π.Υ.Η.":
      return "EMSP" as const;
    default:
      return "OTHER" as const;
  }
}

function cleanHref(value: string) {
  const match = /<a\b[^>]*href="([^"]*)"/i.exec(value);
  const href = clean(decodeEntities(match?.[1] ?? ""));
  if (!href || href === "//") return null;
  return href;
}

function cleanMailto(value: string) {
  const match = /<a\b[^>]*href="mailto:([^"]*)"/i.exec(value);
  return clean(decodeEntities(match?.[1] ?? ""));
}

function normalizeWebsite(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "//") return null;
  const url = trimmed.startsWith("//")
    ? `https:${trimmed}`
    : /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
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
