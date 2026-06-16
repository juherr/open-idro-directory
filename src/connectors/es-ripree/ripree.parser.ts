import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { ripreeXmlRowSchema, type RipreeXmlRow } from "./ripree.types.js";

export function parseRipreeXml(body: string): ParseOutput<RipreeXmlRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  if (!/<Empresas\b[^>]*>/i.test(body)) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "RIPREE_ROOT_NOT_FOUND",
          message: "Spanish RIPREE XML export root element was not found.",
        },
      ],
    };
  }

  const records: RipreeXmlRow[] = [];
  for (const [index, match] of matchAll(body, /<Empresa>([\s\S]*?)<\/Empresa>/gi).entries()) {
    const rowXml = match[1] ?? "";
    const row = {
      document: clean(xmlText(rowXml, "Documento")),
      sourceValue: clean(xmlText(rowXml, "CodigoId")) ?? "",
      companyType: clean(xmlText(rowXml, "TipoEmpresa")) ?? "",
      organizationName: clean(xmlText(rowXml, "RazonSocial")) ?? "",
      address: clean(xmlText(rowXml, "Domicilio")),
      country: clean(xmlText(rowXml, "Pais")),
      autonomousCommunity: clean(xmlText(rowXml, "cAutonoma")),
      province: clean(xmlText(rowXml, "Provincia")),
      municipality: clean(xmlText(rowXml, "Municipio")),
      postalCode: clean(xmlText(rowXml, "CodigoPostal")),
      website: clean(xmlText(rowXml, "Web")),
    };
    const record = ripreeXmlRowSchema.safeParse(row);
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "RIPREE_MALFORMED_ROW",
        message: `Spanish RIPREE row ${index + 1} is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  if (records.length === 0) {
    errors.push({
      severity: "error",
      code: "RIPREE_NO_RECORDS",
      message: "Spanish RIPREE XML export did not contain company records.",
    });
  }

  return { records, warnings, errors };
}

function xmlText(rowXml: string, tagName: string) {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(rowXml);
  return decodeEntities(match?.[1] ?? "");
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'");
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchAll(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)];
}
