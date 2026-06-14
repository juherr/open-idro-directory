import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { afirevRecordSchema, afirevResponseSchema, type AfirevRecord } from "./afirev.types.js";

export function parseAfirevJson(body: string): ParseOutput<AfirevRecord> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "AFIREV_INVALID_JSON",
          message: "AFIREV response is not valid JSON.",
        },
      ],
    };
  }
  const response = afirevResponseSchema.safeParse(parsed);
  if (!response.success) {
    return {
      records: [],
      warnings,
      errors: [
        { severity: "error", code: "AFIREV_INVALID_SHAPE", message: response.error.message },
      ],
    };
  }
  const records: AfirevRecord[] = [];
  response.data.data.forEach((item, index) => {
    const record = afirevRecordSchema.safeParse(item);
    if (!record.success) {
      errors.push({
        severity: "error" as const,
        code: "AFIREV_MALFORMED_ROW",
        message: `AFIREV row ${index} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });
  return { records, warnings, errors };
}
