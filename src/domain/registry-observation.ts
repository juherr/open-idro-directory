import type { NormalizedRegistryRecord, RegistryObservation } from "./registry-record.js";
import { sourceJurisdictions, type SourceDefinition } from "./source-definition.js";

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
 * The observation a record stands for. Records published before the block
 * existed carry none, so it is derived from the source's jurisdictions.
 */
export function observationOf(
  record: NormalizedRegistryRecord,
  source: SourceDefinition,
): RegistryObservation {
  return record.source.observation ?? observationScope(source, record.countryCode);
}
