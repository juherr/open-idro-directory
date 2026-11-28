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

/**
 * How a register came to publish an identifier. `ASSIGNMENT`: the identifier
 * belongs to a country the register covers. `CROSS_REGISTER_LISTING`: the
 * register lists another country's identifier, which neither makes it the
 * issuer nor says anything about the identifier's standing with its issuer.
 */
export const observationKindSchema = z.enum(["ASSIGNMENT", "CROSS_REGISTER_LISTING"]);
export type ObservationKind = z.infer<typeof observationKindSchema>;

/**
 * `observingJurisdiction` is the country whose register published the record:
 * the record's own `countryCode` for an `ASSIGNMENT`; for a
 * `CROSS_REGISTER_LISTING`, the source's jurisdiction when it declares exactly
 * one, and `null` when it covers several (a Benelux register cannot say which
 * of its countries observed the identifier).
 */
export const registryObservationSchema = z.object({
  kind: observationKindSchema,
  observingJurisdiction: emi3CountryCodeSchema.nullable(),
});
export type RegistryObservation = z.infer<typeof registryObservationSchema>;

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
    // Optional so that datasets published before the block existed stay
    // valid; read it through `observationOf`, which derives it when absent.
    observation: registryObservationSchema.optional(),
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

/**
 * A well-formed identifier a register published for a country it does not
 * administer, as builds recorded it before such identifiers were published as
 * cross-register listings. No build adds one any more; the entries already in
 * `data/registry-invalid.json` are kept readable.
 */
export interface OutOfJurisdictionDetection {
  registryId: string;
  code: string;
  sourceValue: string;
  countryCode: string;
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
export type OutOfJurisdictionRow = OutOfJurisdictionDetection & HistoryEntry;

export interface InvalidRegistryHistory {
  generatedAt: string;
  records: InvalidRegistryRecordEntry[];
  rows: RejectedSourceRow[];
  outOfJurisdiction: OutOfJurisdictionRow[];
}

export function makeRegistryKey(
  registryId: string,
  countryCode: string,
  partyId: string,
  role: RegistryRole,
) {
  return `${registryId}:${countryCode}:${partyId}:${role}`;
}
