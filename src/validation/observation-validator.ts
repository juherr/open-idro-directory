import {
  identifierObservationSchema,
  type IdentifierObservation,
} from "../domain/identifier-observation.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

export function validateObservations(observations: IdentifierObservation[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const keys = new Set<string>();
  for (const observation of observations) {
    const parsed = identifierObservationSchema.safeParse(observation);
    if (!parsed.success) {
      issues.push({
        severity: "error",
        code: "OBSERVATION_SCHEMA_ERROR",
        recordKey: observation.key,
        message: parsed.error.message,
      });
    }
    if (keys.has(observation.key)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_OBSERVATION_KEY",
        recordKey: observation.key,
        message: `Duplicate observation key ${observation.key}`,
      });
    }
    keys.add(observation.key);
    if (
      observation.scheme === "OCPI_PARTY_ID" &&
      observation.source.observationType === "OFFICIAL_ASSIGNMENT"
    ) {
      issues.push({
        severity: "error",
        code: "OCPI_AS_OFFICIAL_EMI3",
        recordKey: observation.key,
        message: "OCPI party identifiers must not be classified as official eMI3 assignments.",
      });
    }
    if (
      observation.scheme === "EVSE_PREFIX" &&
      observation.source.authorityLevel !== "UNVERIFIED"
    ) {
      issues.push({
        severity: "error",
        code: "EVSE_PREFIX_AUTHORITY",
        recordKey: observation.key,
        message: "Observed EVSE prefixes must remain unverified infrastructure observations.",
      });
    }
  }
  return issues;
}
