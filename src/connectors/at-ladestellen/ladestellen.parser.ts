import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import {
  ladestellenOperatorSchema,
  ladestellenResponseSchema,
  type LadestellenOperator,
} from "./ladestellen.types.js";

export function parseLadestellenJson(body: string): ParseOutput<LadestellenOperator> {
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
          code: "LADESTELLEN_INVALID_JSON",
          message: "Ladestellen.at response is not valid JSON.",
        },
      ],
    };
  }
  const response = ladestellenResponseSchema.safeParse(parsed);
  if (!response.success) {
    return {
      records: [],
      warnings,
      errors: [
        { severity: "error", code: "LADESTELLEN_INVALID_SHAPE", message: response.error.message },
      ],
    };
  }
  const records: LadestellenOperator[] = [];
  response.data.forEach((item, index) => {
    const record = ladestellenOperatorSchema.safeParse(item);
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "LADESTELLEN_MALFORMED_ROW",
        message: `Ladestellen.at row ${index} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });
  return { records, warnings, errors };
}
