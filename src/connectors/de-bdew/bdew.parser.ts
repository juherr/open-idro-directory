import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { bdewSnapshotSchema, type BdewSnapshot } from "./bdew.types.js";

export function parseBdewJson(body: string): ParseOutput<BdewSnapshot> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const parsed = bdewSnapshotSchema.safeParse(JSON.parse(body));

  if (!parsed.success) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "BDEW_INVALID_JSON",
          message: `Unexpected BDEW JSON shape: ${parsed.error.message}`,
        },
      ],
    };
  }

  return { records: [parsed.data], warnings, errors };
}
