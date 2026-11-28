import type { NormalizedRegistryRecord, RegistryObservation } from "./registry-record.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "./source-definition.js";

/**
 * What a source's record of `countryCode` is: an assignment when the source
 * covers that country, a cross-register listing otherwise. See
 * `registryObservationSchema` for the `observingJurisdiction` rule.
 */
export function observationScope(
  source: SourceDefinition,
  countryCode: string,
): RegistryObservation {
  const country = countryCode.toUpperCase();
  const jurisdictions = sourceJurisdictions(source);
  if (jurisdictions.includes(country)) {
    return { kind: "ASSIGNMENT", observingJurisdiction: country };
  }
  return {
    kind: "CROSS_REGISTER_LISTING",
    observingJurisdiction: jurisdictions.length === 1 ? (jurisdictions[0] ?? null) : null,
  };
}

/**
 * What a connector writes in a record's source block for `countryCode`: the
 * observation scope, and whether the record is official, which takes an
 * authoritative source and an assignment.
 */
export function observedSource(
  source: SourceDefinition,
  countryCode: string,
): { official: boolean; observation: RegistryObservation } {
  const observation = observationScope(source, countryCode);
  return { official: isAuthoritative(source) && observation.kind === "ASSIGNMENT", observation };
}

/**
 * The observation a record stands for. Records published before the block
 * existed carry none, so it is derived from the source's jurisdictions.
 */
export function observationOf(
  record: NormalizedRegistryRecord,
  source: SourceDefinition,
): RegistryObservation {
  return record.source.observation ?? observationScope(source, record.countryCode);
}

/**
 * The record with its observation block, derived when it was published
 * without one. Comparing a published record with fresh connector output
 * otherwise counts the missing block as a change on every record.
 */
export function withObservation(
  record: NormalizedRegistryRecord,
  source: SourceDefinition,
): NormalizedRegistryRecord {
  if (record.source.observation) return record;
  return { ...record, source: { ...record.source, observation: observationOf(record, source) } };
}

/**
 * `withObservation` over published records. Records of a register no source
 * describes are left as they are: there is nothing to derive the block from.
 */
export function withPublishedObservations(
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
): NormalizedRegistryRecord[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return records.map((record) => {
    const source = sourceById.get(record.source.registryId);
    return source ? withObservation(record, source) : record;
  });
}

/** One identifier a register lists for a country it does not cover. */
export interface CrossRegisterListing {
  registryId: string;
  /**
   * The identifier as the register wrote it. When its records spell it
   * differently (`NL*TNM` as CPO, `NLTNM` as EMSP), the smallest spelling.
   */
  sourceValue: string;
  countryCode: string;
  /** Earliest `firstSeenAt` among the identifier's records in that register. */
  firstSeenAt: string;
  /** Latest `lastSeenAt` among the identifier's records in that register. */
  lastSeenAt: string;
}

/**
 * The cross-register listings among published records, once per register and
 * identifier (country code and party ID): a register listing the same
 * identifier as CPO and EMSP lists one identifier, however it spells it in
 * each role. Records of a register no source describes are left out. Sorted
 * by register, then value, then country, so the result does not depend on the
 * order the connectors ran in.
 */
export function crossRegisterListings(
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
): CrossRegisterListing[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const listings = new Map<string, CrossRegisterListing>();
  for (const record of records) {
    const source = sourceById.get(record.source.registryId);
    if (!source || observationOf(record, source).kind !== "CROSS_REGISTER_LISTING") continue;
    const key = `${source.id}:${record.countryCode}:${record.partyId}`;
    const existing = listings.get(key);
    listings.set(key, {
      registryId: source.id,
      sourceValue: smallest(existing?.sourceValue, record.source.sourceValue),
      countryCode: record.countryCode,
      firstSeenAt: earliest(existing?.firstSeenAt, record.source.firstSeenAt),
      lastSeenAt: latest(existing?.lastSeenAt, record.source.lastSeenAt),
    });
  }
  return [...listings.values()].sort(
    (left, right) =>
      compare(left.registryId, right.registryId) ||
      compare(left.sourceValue, right.sourceValue) ||
      compare(left.countryCode, right.countryCode),
  );
}

// Compared as instants: the same moment can be written with or without
// milliseconds, which a string comparison would misorder.
function earliest(current: string | undefined, candidate: string) {
  return current !== undefined && Date.parse(current) <= Date.parse(candidate)
    ? current
    : candidate;
}

function latest(current: string | undefined, candidate: string) {
  return current !== undefined && Date.parse(current) >= Date.parse(candidate)
    ? current
    : candidate;
}

function smallest(current: string | undefined, candidate: string) {
  return current !== undefined && compare(current, candidate) <= 0 ? current : candidate;
}

function compare(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
