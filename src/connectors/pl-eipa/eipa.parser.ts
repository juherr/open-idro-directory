import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { eipaCsvRowSchema, type EipaCsvRow } from "./eipa.types.js";

const EXPECTED_HEADERS = [
  "Nazwa",
  "operator",
  "dostawca",
  "Miejscowość",
  "Państwo",
  "Strona www",
  "Data rejestracji",
];

export function parseEipaCsv(body: string): ParseOutput<EipaCsvRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const rows = parseDelimited(body, ";");
  const headers = rows[0] ?? [];

  if (!headers.every((header, index) => header === EXPECTED_HEADERS[index])) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "EIPA_UNEXPECTED_HEADERS",
          message: `Unexpected EIPA CSV headers: ${headers.join(", ")}`,
        },
      ],
    };
  }

  const records: EipaCsvRow[] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => clean(cell) === null)) return;
    if (row[0]?.startsWith("Stan na dzień:")) return;
    if (row.length !== EXPECTED_HEADERS.length) {
      errors.push({
        severity: "error",
        code: "EIPA_MALFORMED_ROW",
        message: `EIPA CSV row ${index + 2} has ${row.length} columns instead of ${EXPECTED_HEADERS.length}.`,
      });
      return;
    }

    const record = eipaCsvRowSchema.safeParse({
      organizationName: row[0],
      cpoId: clean(row[1]),
      emspId: clean(row[2]),
      city: clean(row[3]),
      country: clean(row[4]),
      website: clean(row[5]),
      registeredAt: clean(row[6]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "EIPA_MALFORMED_ROW",
        message: `EIPA CSV row ${index + 2} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });

  return { records, warnings, errors };
}

function parseDelimited(body: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (quoted) {
      if (char === '"' && body[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }

  if (quoted) throw new Error("Unterminated quoted CSV field.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function clean(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
