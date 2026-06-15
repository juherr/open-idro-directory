import { readSheet } from "read-excel-file/node";
import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import {
  energimyndighetenRowSchema,
  energimyndighetenSnapshotSchema,
  type EnergimyndighetenRow,
} from "./energimyndigheten.types.js";

export async function parseEnergimyndighetenSnapshot(
  body: string,
): Promise<ParseOutput<EnergimyndighetenRow>> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const parsed = energimyndighetenSnapshotSchema.safeParse(JSON.parse(body));

  if (!parsed.success) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "ENERGIMYNDIGHETEN_INVALID_SNAPSHOT",
          message: `Unexpected Swedish Energy Agency snapshot shape: ${parsed.error.message}`,
        },
      ],
    };
  }

  const records = [
    ...(await parseWorkbook(
      parsed.data.cpo.contentBase64,
      "CPO",
      parsed.data.cpo.url,
      warnings,
      errors,
    )),
    ...(await parseWorkbook(
      parsed.data.emsp.contentBase64,
      "EMSP",
      parsed.data.emsp.url,
      warnings,
      errors,
    )),
  ];

  return { records, warnings, errors };
}

async function parseWorkbook(
  contentBase64: string,
  role: "CPO" | "EMSP",
  sourceUrl: string,
  warnings: ValidationIssue[],
  errors: ValidationIssue[],
) {
  const rows = await readSheet(Buffer.from(contentBase64, "base64"));
  const headers = (rows[0] ?? []).map((value) => clean(String(value ?? "")) ?? "");
  if (!hasExpectedHeaders(headers, role)) {
    errors.push({
      severity: "error",
      code: "ENERGIMYNDIGHETEN_UNEXPECTED_HEADERS",
      message: `Unexpected Swedish Energy Agency ${role} headers: ${headers.join(", ")}`,
    });
    return [];
  }

  const records: EnergimyndighetenRow[] = [];
  rows.slice(1).forEach((row, index) => {
    const identifier = clean(String(row[0] ?? ""));
    const organizationName = clean(String(row[1] ?? ""));
    if (!identifier && !organizationName) return;
    if (!identifier) {
      warnings.push({
        severity: "warning",
        code: "ENERGIMYNDIGHETEN_MISSING_IDENTIFIER",
        message: `Swedish Energy Agency ${role} row ${index + 2} has no identifier.`,
      });
      return;
    }

    const record = energimyndighetenRowSchema.safeParse({
      sourceValue: identifier,
      organizationName,
      role,
      sourceUrl,
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "ENERGIMYNDIGHETEN_MALFORMED_ROW",
        message: `Swedish Energy Agency ${role} row ${index + 2} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });

  return records;
}

function hasExpectedHeaders(headers: string[], role: "CPO" | "EMSP") {
  const identifierHeader = role === "CPO" ? "ESVEid" : "ID";
  return headers[0] === identifierHeader && headers[1] === "Operator";
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
