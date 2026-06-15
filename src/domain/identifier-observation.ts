import { z } from "zod";
import { registryRoleSchema, registryStatusSchema } from "./registry-record.js";

export const identifierSchemeSchema = z.enum([
  "EMI3_OPERATOR_ID",
  "EMI3_PROVIDER_ID",
  "OCPI_PARTY_ID",
  "OCN_PARTY_ID",
  "HUB_PARTY_ID",
  "NATIONAL_INTERNAL_ID",
  "EVSE_PREFIX",
  "UNKNOWN",
]);
export type IdentifierScheme = z.infer<typeof identifierSchemeSchema>;

export const authorityLevelSchema = z.enum([
  "AUTHORITATIVE",
  "SUPRANATIONAL_DIRECTORY",
  "SECONDARY",
  "SELF_ASSERTED",
  "UNVERIFIED",
]);
export type AuthorityLevel = z.infer<typeof authorityLevelSchema>;

export const observationTypeSchema = z.enum([
  "OFFICIAL_ASSIGNMENT",
  "OFFICIAL_DIRECTORY_ENTRY",
  "LEGACY_ASSIGNMENT",
  "NETWORK_REGISTRATION",
  "INFRASTRUCTURE_OBSERVATION",
  "SELF_DECLARATION",
  "COMMUNITY_OBSERVATION",
]);
export type ObservationType = z.infer<typeof observationTypeSchema>;

export const sourceAssessmentSchema = z.object({
  sourceId: z.string().min(1),
  scores: z.object({
    authority: z.number().int().min(0).max(5),
    freshness: z.number().int().min(0).max(5),
    machineReadability: z.number().int().min(0).max(5),
    coverage: z.number().int().min(0).max(5),
    legalClarity: z.number().int().min(0).max(5),
    stability: z.number().int().min(0).max(5),
    uniquenessValue: z.number().int().min(0).max(5),
    maintenanceCost: z.number().int().min(0).max(5),
  }),
  reasons: z.array(z.string()),
});
export type SourceAssessment = z.infer<typeof sourceAssessmentSchema>;

export const identifierObservationSchema = z.object({
  key: z.string().min(1),
  scheme: identifierSchemeSchema,
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  partyId: z.string().min(1),
  normalizedValue: z.string().min(1),
  role: registryRoleSchema,
  status: registryStatusSchema,
  organization: z.object({
    name: z.string().nullable(),
    legalName: z.string().nullable(),
    website: z.string().url().nullable(),
  }),
  source: z.object({
    sourceId: z.string().min(1),
    authorityLevel: authorityLevelSchema,
    observationType: observationTypeSchema,
    sourceRecordId: z.string().nullable(),
    sourceValue: z.string().min(1),
    sourceUrl: z.string().url(),
    evidenceUrl: z.string().url().nullable(),
    firstSeenAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
    retrievedAt: z.string().datetime(),
  }),
  confidence: z.object({
    score: z.number().min(0).max(1),
    reasons: z.array(z.string()),
  }),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type IdentifierObservation = z.infer<typeof identifierObservationSchema>;

export function makeObservationKey(input: {
  sourceId: string;
  scheme: IdentifierScheme;
  countryCode: string | null;
  partyId: string;
  role: string;
  sourceRecordId: string | null;
  sourceValue: string;
}) {
  const recordDiscriminator = input.sourceRecordId ?? input.sourceValue;
  return [
    input.sourceId,
    input.scheme,
    input.countryCode ?? "ZZ",
    input.partyId,
    input.role,
    recordDiscriminator,
  ].join(":");
}
