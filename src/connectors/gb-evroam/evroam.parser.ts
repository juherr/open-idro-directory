import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import {
  evroamRegisterItemSchema,
  evroamRegisterResponseSchema,
  type EvroamRegisterItem,
} from "./evroam.types.js";

export function parseEvroamRegister(body: string): ParseOutput<EvroamRegisterItem> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (error) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "EVROAM_INVALID_JSON",
          message: `EV Roam register JSON is malformed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
  const parsed = evroamRegisterResponseSchema.safeParse(json);

  if (!parsed.success) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "EVROAM_INVALID_RESPONSE",
          message: `EV Roam register response is malformed: ${parsed.error.message}`,
        },
      ],
    };
  }

  const records: EvroamRegisterItem[] = [];
  for (const item of parsed.data.items) {
    const record = evroamRegisterItemSchema.safeParse(item);
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "EVROAM_MALFORMED_ROW",
        message: `EV Roam register row is malformed: ${record.error.message}`,
      });
      continue;
    }
    records.push(record.data);
  }

  if (records.length === 0) {
    errors.push({
      severity: "error",
      code: "EVROAM_NO_RECORDS",
      message: "EV Roam register did not contain parseable records.",
    });
  }

  return { records, warnings, errors };
}
