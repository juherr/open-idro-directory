import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { AuthorityDefinition } from "../domain/authority-definition.js";
import { crossRegisterListings } from "../domain/registry-observation.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "../domain/source-definition.js";
import { coversJurisdiction } from "../validation/identifier-scope.js";

interface OutOfJurisdictionFinding {
  sourceValue: string;
  countryCode: string;
  /** Earliest `source.firstSeenAt` of the identifier's records in that register. */
  firstDetectedAt: string;
  /** Latest `source.lastSeenAt` of the identifier's records in that register. */
  lastDetectedAt: string;
  /** The register appointed for that country, when this directory tracks one. */
  administeredBy: { registryId: string; authority: AuthorityDefinition } | null;
}

interface OutOfJurisdictionRegister {
  registryId: string;
  registryName: string;
  jurisdictions: string[];
  /** The organisation to write to, in the shape `data/sources.json` publishes. */
  authority: AuthorityDefinition;
  identifiers: OutOfJurisdictionFinding[];
}

interface OutOfJurisdictionReport {
  generatedAt: string;
  totalIdentifiers: number;
  registers: OutOfJurisdictionRegister[];
}

/**
 * Lists the cross-register listings the published records hold: identifiers a
 * register publishes for a country it does not cover. They are grouped by the
 * register that lists them, with the organisation behind it and, for each
 * identifier, the register appointed for its country.
 *
 * A listing says nothing about the identifier's standing with its issuer: the
 * report is there so the register can be compared with the appointed one, not
 * to flag the identifier.
 */
export function buildOutOfJurisdictionReport(
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
  generatedAt: string,
): OutOfJurisdictionReport {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const listings = crossRegisterListings(records, sources);
  // `crossRegisterListings` sorts by register then value, which both orders
  // survive.
  const registers = [...Map.groupBy(listings, (listing) => listing.registryId)].map(
    ([registryId, entries]) => {
      // Present because `crossRegisterListings` keeps only described registers.
      const source = sourceById.get(registryId) as SourceDefinition;
      return {
        registryId,
        registryName: source.name,
        jurisdictions: sourceJurisdictions(source),
        authority: source.authority,
        identifiers: entries.map((entry) => ({
          sourceValue: entry.sourceValue,
          countryCode: entry.countryCode,
          firstDetectedAt: entry.firstSeenAt,
          lastDetectedAt: entry.lastSeenAt,
          administeredBy: appointedRegisterFor(entry.countryCode, sources),
        })),
      };
    },
  );

  return { generatedAt, totalIdentifiers: listings.length, registers };
}

function appointedRegisterFor(countryCode: string, sources: SourceDefinition[]) {
  const appointed = sources.find(
    (source) => isAuthoritative(source) && coversJurisdiction(source, countryCode),
  );
  return appointed ? { registryId: appointed.id, authority: appointed.authority } : null;
}
