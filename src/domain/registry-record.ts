import { z } from "zod";
import {
  emi3CountryCodeSchema,
  emi3IdentifierSchema,
  emi3PartyIdSchema,
  type Emi3ValidityReason,
} from "./emi3-identifier.js";

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
  countryCode: emi3CountryCodeSchema,
  partyId: emi3PartyIdSchema,
  eMobilityId: emi3IdentifierSchema,
  role: registryRoleSchema,
  status: registryStatusSchema,
  organization: z.object({
    name: z.string().min(1),
    legalName: z.string().nullable(),
    website: z.url().nullable(),
  }),
  source: z.object({
    registryId: z.string().min(1),
    official: z.boolean(),
    sourceRecordId: z.string().nullable(),
    sourceUrl: z.url(),
    sourceValue: z.string().min(1),
    firstSeenAt: z.iso.datetime(),
    lastSeenAt: z.iso.datetime(),
    retrievedAt: z.iso.datetime(),
  }),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type NormalizedRegistryRecord = z.infer<typeof normalizedRegistryRecordSchema>;

// Records whose identifier is not a valid eMI3 assignment are excluded from the
// published datasets and collected in `data/registry-invalid.json` instead.
export interface InvalidRegistryRecordDetection {
  reasons: Emi3ValidityReason[];
  record: NormalizedRegistryRecord;
}

// Upstream rows rejected earlier, by a connector, because their raw value could
// not be split into a country code and a party ID at all. They never become a
// record, so they are reported next to the invalid records rather than among
// them.
export interface RejectedSourceRowDetection {
  registryId: string;
  code: string;
  sourceValue: string;
  message: string;
}

// Detections are accumulated rather than replaced: an identifier a source has
// stopped publishing stays on record so the correction it received (or the
// absence of one) remains traceable. `supersededBy` is the eMobility ID that
// replaced it upstream, filled in by hand and preserved across builds.
interface HistoryEntry {
  firstDetectedAt: string;
  lastDetectedAt: string;
  supersededBy: string | null;
}

export type InvalidRegistryRecordEntry = InvalidRegistryRecordDetection & HistoryEntry;
export type RejectedSourceRow = RejectedSourceRowDetection & HistoryEntry;

export interface InvalidRegistryHistory {
  generatedAt: string;
  records: InvalidRegistryRecordEntry[];
  rows: RejectedSourceRow[];
}

export function makeRegistryKey(
  registryId: string,
  countryCode: string,
  partyId: string,
  role: RegistryRole,
) {
  return `${registryId}:${countryCode}:${partyId}:${role}`;
}
