import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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
  const rows = await readSheet(withoutDeclaredDimensions(content));
  // The schemas below read text; a numeric cell would otherwise arrive as a
  // number and fail them for a reason that has nothing to do with the register.
  return rows.map((row) => row.map((cell) => (cell === null ? "" : String(cell))));
}

/**
 * The register publishes a workbook that declares `<dimension ref="A1"/>` -- "this
 * sheet holds a single cell" -- for a sheet holding hundreds. `read-excel-file`
 * honours that declaration and returns the first row alone, silently losing the
 * register; its own source notes the same default in Apache POI. Without the
 * element it reconstructs the range from the cells it finds, which is what the
 * file actually contains.
 *
 * Version 9.3 drops the declaration itself, which would make this step
 * unnecessary -- but its rewritten parser also fails on a workbook that carries
 * no shared-string table, which is how a file storing its text inline is
 * written and what the Swedish registers exercise. That support was added
 * deliberately in 4.0.7 (catamphetamine/read-excel-file#85) and lost again in
 * 9.3.0. Drop this step once it is back.
 */
function withoutDeclaredDimensions(content: Buffer) {
  const files = unzipSync(new Uint8Array(content));
  for (const [path, file] of Object.entries(files)) {
    if (!path.startsWith("xl/worksheets/")) continue;
    files[path] = strToU8(
      strFromU8(file).replace(/<dimension\b[^>]*\/>|<dimension\b[^>]*>[\s\S]*?<\/dimension>/g, ""),
    );
  }
  return Buffer.from(zipSync(files));
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
