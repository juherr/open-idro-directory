import type { ParseOutput } from "../connector.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { suisseEnergiePageDataSchema, type SuisseEnergieProvider } from "./suisseenergie.types.js";

export function parseSuisseEnergieJson(body: string): ParseOutput<SuisseEnergieProvider> {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];
  const parsed = suisseEnergiePageDataSchema.safeParse(JSON.parse(body));

  if (!parsed.success) {
    return {
      records: [],
      warnings,
      errors: [
        {
          severity: "error",
          code: "SUISSEENERGIE_INVALID_JSON",
          message: `Unexpected SuisseEnergie JSON shape: ${parsed.error.message}`,
        },
      ],
    };
  }

  return { records: parsed.data.data.providers.nodes, warnings, errors };
}
