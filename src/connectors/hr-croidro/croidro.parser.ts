import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { croIdroCsvRowSchema, type CroIdroCsvRow } from "./croidro.types.js";

const EXPECTED_HEADERS = ["Naziv tvrtke/osobe", "CPO ID", "MSP ID"];
const ALTERNATE_COMPANY_HEADERS = new Set(["Naziv tvrtke/osobe", "Naziv tvrtke / osobe"]);

export function parseCroIdroCsv(body: string): ParseOutput<CroIdroCsvRow> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const rows = parseCsv(body);
  if (rows.length === 0) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "CROIDRO_EMPTY_CSV",
          message: "Croatian IDRO export is empty.",
        },
      ],
    };
  }

  const headers = rows[0] ?? [];
  if (!hasExpectedHeaders(headers)) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "CROIDRO_UNEXPECTED_HEADERS",
          message: `Unexpected Croatian IDRO CSV headers: ${headers.join(", ")}`,
        },
      ],
    };
  }

  const records: CroIdroCsvRow[] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.length === 1 && clean(row[0]) === null) return;
    if (row.length !== EXPECTED_HEADERS.length) {
      errors.push({
        severity: "error",
        code: "CROIDRO_MALFORMED_ROW",
        message: `Croatian IDRO row ${index + 2} has ${row.length} columns instead of ${EXPECTED_HEADERS.length}.`,
      });
      return;
    }

    const record = croIdroCsvRowSchema.safeParse({
      companyName: row[0],
      cpoIds: parseIdentifierList(row[1]),
      emspIds: parseIdentifierList(row[2]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "CROIDRO_MALFORMED_ROW",
        message: `Croatian IDRO row ${index + 2} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });

  return { records, warnings, errors };
}

function hasExpectedHeaders(headers: string[]) {
  return (
    headers.length === EXPECTED_HEADERS.length &&
    ALTERNATE_COMPANY_HEADERS.has(headers[0] ?? "") &&
    headers[1] === EXPECTED_HEADERS[1] &&
    headers[2] === EXPECTED_HEADERS[2]
  );
}

function parseCsv(body: string) {
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

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (quoted) throw new Error("Unterminated quoted CSV field.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseIdentifierList(value: string | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*[;|]\s*/)
    .map(clean)
    .filter((item): item is string => item !== null);
}

function clean(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
