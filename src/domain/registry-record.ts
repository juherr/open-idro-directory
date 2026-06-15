import { z } from "zod";

export const registryRoleSchema = z.enum(["CPO", "CSO", "EMSP", "NSP", "HUB", "OTHER"]);
export type RegistryRole = z.infer<typeof registryRoleSchema>;

export const registryStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "RESERVED",
  "REVOKED",
  "UNKNOWN",
]);
export type RegistryStatus = z.infer<typeof registryStatusSchema>;

export const normalizedRegistryRecordSchema = z.object({
  key: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  partyId: z.string().min(1),
  eMobilityId: z.string().min(3),
  role: registryRoleSchema,
  status: registryStatusSchema,
  organization: z.object({
    name: z.string().min(1),
    legalName: z.string().nullable(),
    website: z.string().url().nullable(),
  }),
  source: z.object({
    registryId: z.string().min(1),
    official: z.boolean(),
    sourceRecordId: z.string().nullable(),
    sourceUrl: z.string().url(),
    sourceValue: z.string().min(1),
    firstSeenAt: z.string().datetime(),
    lastSeenAt: z.string().datetime(),
    retrievedAt: z.string().datetime(),
  }),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type NormalizedRegistryRecord = z.infer<typeof normalizedRegistryRecordSchema>;

export function makeRegistryKey(
  registryId: string,
  countryCode: string,
  partyId: string,
  role: RegistryRole,
) {
  return `${registryId}:${countryCode}:${partyId}:${role}`;
}
