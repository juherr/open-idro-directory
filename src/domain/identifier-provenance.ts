import type {
  IssuingConfirmation,
  IssuingProvenance,
  NormalizedRegistryRecord,
  RegistryRole,
} from "./registry-record.js";
import { observationOf } from "./registry-observation.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "./source-definition.js";

// The schemas live next to the record schema that embeds them: defining them
// here would close a runtime import cycle through `source-definition.ts`.
export {
  issuingConfirmationSchema,
  issuingProvenanceSchema,
  type IssuingConfirmation,
  type IssuingProvenance,
} from "./registry-record.js";

/**
 * How a source fared in the latest build, as the classifier needs it:
 * `CURRENT` (fetched and fresh), `STALE` (kept from an older retrieval) or
 * `UNAVAILABLE` (failed). Mapping build results or published health onto it
 * is the caller's job.
 */
export type SourceHealthState = "CURRENT" | "STALE" | "UNAVAILABLE";

/** The identifier and role a classification is about: `CC:PID:ROLE`. */
export function identifierRoleKey(
  record: Pick<NormalizedRegistryRecord, "countryCode" | "partyId" | "role">,
): string {
  return `${record.countryCode}:${record.partyId}:${record.role}`;
}

/**
 * What the issuing registers say about each identifier and role present in
 * `records`, keyed by `identifierRoleKey`.
 *
 * The issuing registers of `CC:PID:ROLE` are the authoritative sources,
 * enabled or not, whose effective jurisdictions include `CC` and whose
 * register publishes `ROLE`. One of them confirms the identifier when it holds
 * an assignment of it that its latest retrieval still listed, whatever the
 * upstream status and whatever that source's health. Otherwise the answer
 * depends on the issuing registers' health: any disabled, failed or of unknown
 * health gives `SOURCE_UNAVAILABLE`, else any stale gives `SOURCE_STALE`, else
 * `NOT_FOUND`. Listings by other registers never confirm. The result does not
 * depend on the order of `records` or `sources`.
 */
export function classifyIdentifierProvenance(
  records: readonly NormalizedRegistryRecord[],
  sources: readonly SourceDefinition[],
  healthBySourceId: Readonly<Record<string, SourceHealthState>>,
): Map<string, IssuingProvenance> {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const coveringByCountry = new Map<string, SourceDefinition[]>();
  const coveringSources = (country: string) => {
    let covering = coveringByCountry.get(country);
    if (!covering) {
      covering = sources.filter(
        (source) => isAuthoritative(source) && sourceJurisdictions(source).includes(country),
      );
      coveringByCountry.set(country, covering);
    }
    return covering;
  };

  const identifiers = new Map<
    string,
    { country: string; role: RegistryRole; confirmedBy: Set<string> }
  >();
  for (const record of records) {
    const key = identifierRoleKey(record);
    let identifier = identifiers.get(key);
    if (!identifier) {
      identifier = { country: record.countryCode, role: record.role, confirmedBy: new Set() };
      identifiers.set(key, identifier);
    }
    const source = sourceById.get(record.source.registryId);
    if (source && confirms(record, source, coveringSources(record.countryCode))) {
      identifier.confirmedBy.add(source.id);
    }
  }

  const classification = new Map<string, IssuingProvenance>();
  for (const [key, { country, role, confirmedBy }] of identifiers) {
    const covering = coveringSources(country);
    const issuing = covering.filter((source) => source.registry.supportedRoles.includes(role));
    classification.set(key, {
      country,
      confirmation:
        confirmedBy.size > 0
          ? "CONFIRMED"
          : unconfirmed(covering.length > 0, issuing, healthBySourceId),
      confirmedBy: [...confirmedBy].sort(),
    });
  }
  return classification;
}

/** Each record with the `issuing` block of its identifier and role. */
export function withIssuingProvenance(
  records: readonly NormalizedRegistryRecord[],
  classification: ReadonlyMap<string, IssuingProvenance>,
): NormalizedRegistryRecord[] {
  return records.map((record) => {
    const issuing = classification.get(identifierRoleKey(record));
    return issuing ? { ...record, issuing } : record;
  });
}

/**
 * The record without its `issuing` block. The block is derived on every build
 * from every source, so a published one is dropped before it is compared with,
 * or carried into, a fresh build.
 */
export function withoutIssuingProvenance(
  record: NormalizedRegistryRecord,
): NormalizedRegistryRecord {
  const { issuing: _issuing, ...rest } = record;
  return rest;
}

/**
 * Whether `record`, published by `source`, comes from an issuing register for
 * its country and role and stands for an assignment. `covering` holds the
 * authoritative sources whose effective jurisdictions include the record's
 * country. Presence is not checked: a tombstone of an issuing register still
 * counts.
 */
export function isIssuingAssignment(
  record: NormalizedRegistryRecord,
  source: SourceDefinition,
  covering: readonly SourceDefinition[],
): boolean {
  return (
    covering.includes(source) &&
    source.registry.supportedRoles.includes(record.role) &&
    observationOf(record, source).kind === "ASSIGNMENT"
  );
}

/** Whether the record was listed by its source's latest retrieval. */
export function isInLatestRetrieval(record: NormalizedRegistryRecord): boolean {
  return record.source.lastSeenAt === record.source.retrievedAt;
}

/**
 * The health a source counts with: `UNAVAILABLE` when the source is unknown,
 * disabled, or has no known state, else `state`.
 */
export function effectiveHealthState(
  source: SourceDefinition | undefined,
  state: SourceHealthState | undefined,
): SourceHealthState {
  return source?.publication.enabled && state !== undefined ? state : "UNAVAILABLE";
}

// A record confirms when it comes from an issuing register, stands for an
// assignment, and was present in that register's latest retrieval: a
// tombstone kept after the identifier vanished upstream has an older
// `lastSeenAt` and confirms nothing.
function confirms(
  record: NormalizedRegistryRecord,
  source: SourceDefinition,
  covering: readonly SourceDefinition[],
) {
  return isIssuingAssignment(record, source, covering) && isInLatestRetrieval(record);
}

function unconfirmed(
  covered: boolean,
  issuing: readonly SourceDefinition[],
  healthBySourceId: Readonly<Record<string, SourceHealthState>>,
): IssuingConfirmation {
  if (!covered) return "NO_ISSUING_SOURCE";
  if (issuing.length === 0) return "UNSUPPORTED_ROLE";
  const states = issuing.map((source) =>
    effectiveHealthState(
      source,
      Object.hasOwn(healthBySourceId, source.id) ? healthBySourceId[source.id] : undefined,
    ),
  );
  if (states.includes("UNAVAILABLE")) return "SOURCE_UNAVAILABLE";
  if (states.includes("STALE")) return "SOURCE_STALE";
  return "NOT_FOUND";
}
