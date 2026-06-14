import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { beneluxCsvRowSchema, type BeneluxCsvRow } from "./benelux.types.js";

const EXPECTED_HEADERS = ["Company Name", "Operator-ID (CPO)", "Provider-ID (MSP)", "Website"];

export function parseBeneluxCsv(body: string): ParseOutput<BeneluxCsvRow> {
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
          code: "BENELUX_EMPTY_CSV",
          message: "Benelux IDRO export is empty.",
        },
      ],
    };
  }

  const headers = rows[0] ?? [];
  if (
    headers.length !== EXPECTED_HEADERS.length ||
    !headers.every((h, i) => h === EXPECTED_HEADERS[i])
  ) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "BENELUX_UNEXPECTED_HEADERS",
          message: `Unexpected Benelux IDRO CSV headers: ${headers.join(", ")}`,
        },
      ],
    };
  }

  const records: BeneluxCsvRow[] = [];
  rows.slice(1).forEach((row, index) => {
    if (row.length === 1 && clean(row[0]) === null) return;
    if (row.length !== EXPECTED_HEADERS.length) {
      errors.push({
        severity: "error",
        code: "BENELUX_MALFORMED_ROW",
        message: `Benelux IDRO row ${index + 2} has ${row.length} columns instead of ${EXPECTED_HEADERS.length}.`,
      });
      return;
    }
    const record = beneluxCsvRowSchema.safeParse({
      companyName: row[0],
      cpoIds: parseIdentifierList(row[1]),
      emspIds: parseIdentifierList(row[2]),
      website: clean(row[3]),
    });
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "BENELUX_MALFORMED_ROW",
        message: `Benelux IDRO row ${index + 2} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });

  return { records, warnings, errors };
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
  return (value ?? "")
    .split(" - ")
    .map(clean)
    .filter((item): item is string => item !== null && item !== "/");
}

function clean(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
