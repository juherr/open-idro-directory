import { readSheet } from "read-excel-file/node";
import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { napRowSchema, type NapRow } from "./nap.types.js";

const EXPECTED_HEADERS = ["Naziv", "MSP ID koda", "CPO ID koda"];

export async function parseNapSnapshot(body: string): Promise<ParseOutput<NapRow>> {
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

  const rows = await workbookRows(Buffer.from(parsed.contentBase64, "base64"));
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

async function workbookRows(content: Buffer) {
  const rows = await readSheet(content);
  // The schemas below read text; a numeric cell would otherwise arrive as a
  // number and fail them for a reason that has nothing to do with the register.
  return rows.map((row) => row.map((cell) => (cell === null ? "" : String(cell))));
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
