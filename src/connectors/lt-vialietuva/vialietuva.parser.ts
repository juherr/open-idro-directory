import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { vialietuvaLocationSchema, type VialietuvaLocation } from "./vialietuva.types.js";

export function parseVialietuvaLocations(body: string): ParseOutput<VialietuvaLocation> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const parsed = JSON.parse(body) as { data?: unknown[] };
  if (!Array.isArray(parsed.data)) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "VIALIETUVA_INVALID_RESPONSE",
          message: "Via Lietuva OCPI locations response does not contain a data array.",
        },
      ],
    };
  }

  const records: VialietuvaLocation[] = [];
  parsed.data.forEach((item, index) => {
    const record = vialietuvaLocationSchema.safeParse(item);
    if (!record.success) {
      errors.push({
        severity: "error",
        code: "VIALIETUVA_MALFORMED_LOCATION",
        message: `Via Lietuva location ${index + 1} is malformed: ${record.error.message}`,
      });
      return;
    }
    records.push(record.data);
  });

  return { records, warnings, errors };
}
