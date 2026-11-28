import { EMI3_COUNTRY_CODE_PATTERN } from "../domain/emi3-identifier.js";
import {
  issuingConfirmationSchema,
  registryRoleSchema,
  registryStatusSchema,
} from "../domain/registry-record.js";
import {
  DISCREPANCY_CATEGORIES,
  DISCREPANCY_CONFIDENCES,
  DISCREPANCY_SEVERITIES,
} from "./discrepancy-report.js";

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const countryCode = { type: "string", pattern: EMI3_COUNTRY_CODE_PATTERN.source };
const counts = (keys: readonly string[]) => ({
  type: "object",
  required: [...keys],
  properties: Object.fromEntries(keys.map((key) => [key, { type: "integer", minimum: 0 }])),
});

/** `schemas/discrepancies.schema.json`: the shape of `data/reports/discrepancies.json`. */
export const discrepanciesSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "DiscrepancyReport",
  type: "object",
  required: ["generatedAt", "summary", "countries"],
  properties: {
    generatedAt: { type: "string" },
    summary: {
      type: "object",
      required: ["totalFindings", "byCategory", "bySeverity"],
      properties: {
        totalFindings: { type: "integer", minimum: 0 },
        byCategory: counts(DISCREPANCY_CATEGORIES),
        bySeverity: counts(DISCREPANCY_SEVERITIES),
      },
    },
    countries: {
      type: "array",
      items: {
        type: "object",
        required: ["countryCode", "issuingRegistryIds", "pairs"],
        properties: {
          // `null` for findings about a source that covers several countries.
          countryCode: nullable(countryCode),
          issuingRegistryIds: { type: "array", items: { type: "string" } },
          pairs: {
            type: "array",
            items: {
              type: "object",
              required: ["issuingRegistryId", "observedRegistryId", "findings"],
              properties: {
                issuingRegistryId: nullable({ type: "string" }),
                observedRegistryId: { type: "string" },
                findings: { type: "array", items: { $ref: "#/$defs/finding" } },
              },
            },
          },
        },
      },
    },
  },
  $defs: {
    finding: {
      type: "object",
      required: [
        "category",
        "severity",
        "confidence",
        "countryCode",
        "issuingRegistryId",
        "observedRegistryId",
        "identifier",
        "issuingConfirmation",
        "summary",
        "evidence",
      ],
      properties: {
        category: { enum: DISCREPANCY_CATEGORIES },
        severity: { enum: DISCREPANCY_SEVERITIES },
        confidence: { enum: DISCREPANCY_CONFIDENCES },
        countryCode: nullable(countryCode),
        issuingRegistryId: nullable({ type: "string" }),
        observedRegistryId: { type: "string" },
        identifier: nullable({
          type: "object",
          required: ["countryCode", "partyId", "role", "eMobilityId"],
          properties: {
            countryCode: { type: "string" },
            partyId: { type: "string" },
            role: { enum: registryRoleSchema.options },
            eMobilityId: { type: "string" },
          },
        }),
        issuingConfirmation: nullable({ enum: issuingConfirmationSchema.options }),
        reason: { type: "string" },
        summary: { type: "string" },
        evidence: { type: "array", minItems: 1, items: { $ref: "#/$defs/evidence" } },
      },
    },
    evidence: {
      type: "object",
      required: ["recordKey", "registryId", "retrievedAt", "lastSeenAt"],
      properties: {
        recordKey: nullable({ type: "string" }),
        registryId: { type: "string" },
        retrievedAt: nullable({ type: "string" }),
        lastSeenAt: nullable({ type: "string" }),
        firstSeenAt: { type: "string" },
        role: { enum: registryRoleSchema.options },
        status: { enum: registryStatusSchema.options },
        organizationName: { type: "string" },
        sourceValue: { type: "string" },
        healthState: { enum: ["CURRENT", "STALE", "UNAVAILABLE"] },
        recordCount: { type: "integer", minimum: 0 },
        firstDetectedAt: { type: "string" },
        lastDetectedAt: { type: "string" },
        code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
};
