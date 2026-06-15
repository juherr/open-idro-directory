import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { huIdroHtmlRowSchema, type HuIdroHtmlRow } from "./hu-idro.types.js";

export function parseHuIdroHtml(body: string): ParseOutput<HuIdroHtmlRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const content = findMembersContent(body);
  if (!content) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "HU_IDRO_MEMBERS_NOT_FOUND",
          message: "Hungarian IDRO members list was not found in the HTML page.",
        },
      ],
    };
  }

  const records: HuIdroHtmlRow[] = [];
  for (const [index, itemMatch] of matchAll(
    content,
    /<li\b[^>]*class="[^"]*\bmy-3\b[^"]*"[^>]*>([\s\S]*?)(?=<li\b[^>]*class="[^"]*\bmy-3\b[^"]*"|<\/ul>\s*<\/span>)/gi,
  ).entries()) {
    const itemHtml = itemMatch[1] ?? "";
    const organizationName = clean(
      htmlText(/<b\b[^>]*>([\s\S]*?)<\/b>/i.exec(itemHtml)?.[1] ?? ""),
    );
    if (!organizationName) {
      errors.push({
        severity: "error",
        code: "HU_IDRO_MISSING_ORGANIZATION",
        message: `Hungarian IDRO member row ${index + 1} does not include an organization name.`,
      });
      continue;
    }

    const taxNumber = clean(/Adószám:\s*([^<]+)/i.exec(itemHtml)?.[1]);
    const identifiers = matchAll(itemHtml, /<li>([\s\S]*?)<\/li>/gi).map((match) =>
      htmlText(match[1] ?? ""),
    );

    for (const sourceValue of identifiers) {
      const role = inferRole(sourceValue);
      if (!role) {
        warnings.push({
          severity: "warning",
          code: "HU_IDRO_UNKNOWN_ROLE",
          message: `Hungarian IDRO identifier does not expose a CPO or EMSP role: ${sourceValue}`,
        });
        continue;
      }
      const record = huIdroHtmlRowSchema.safeParse({
        organizationName,
        taxNumber,
        sourceValue,
        role,
      });
      if (!record.success) {
        errors.push({
          severity: "error",
          code: "HU_IDRO_MALFORMED_IDENTIFIER",
          message: `Hungarian IDRO member row ${index + 1} is malformed: ${record.error.message}`,
        });
        continue;
      }
      records.push(record.data);
    }
  }

  return { records, warnings, errors };
}

function findMembersContent(body: string) {
  return body.includes("Members and ID list") || body.includes("Tagság és ID lista") ? body : null;
}

function inferRole(sourceValue: string) {
  const value = sourceValue.toUpperCase();
  if (value.includes("CPO")) return "CPO" as const;
  if (value.includes("EMS") || value.includes("MSP")) return "EMSP" as const;
  return null;
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
