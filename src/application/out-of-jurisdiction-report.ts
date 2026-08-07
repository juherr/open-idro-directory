import type { InvalidRegistryHistory } from "../domain/registry-record.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "../domain/source-definition.js";

export interface ReportContact {
  authorityId: string;
  authorityName: string;
  homepageUrl: string;
}

export interface OutOfJurisdictionFinding {
  sourceValue: string;
  countryCode: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  /** The registry appointed for that country, when this directory knows one. */
  administeredBy: (ReportContact & { sourceId: string }) | null;
}

export interface OutOfJurisdictionRegister {
  registryId: string;
  registryName: string;
  jurisdictions: string[];
  contact: ReportContact;
  identifierCount: number;
  identifiers: OutOfJurisdictionFinding[];
}

export interface OutOfJurisdictionReport {
  generatedAt: string;
  totalIdentifiers: number;
  registers: OutOfJurisdictionRegister[];
}

/**
 * Turns the out-of-jurisdiction findings into something an editor can act on:
 * grouped by the register that publishes them, with the organisation to write
 * to and, for each identifier, the registry appointed for that country.
 *
 * Only what the current run still sees is listed. A register that has corrected
 * its export drops out of the report while staying in the history.
 */
export function buildOutOfJurisdictionReport(
  invalid: InvalidRegistryHistory,
  sources: SourceDefinition[],
  generatedAt: string,
): OutOfJurisdictionReport {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const current = (invalid.outOfJurisdiction ?? []).filter(
    (entry) => entry.lastDetectedAt === generatedAt,
  );
  const byRegistry = Map.groupBy(current, (entry) => entry.registryId);
  const registers = [...byRegistry.entries()]
    .flatMap(([registryId, entries]) => {
      const source = sourceById.get(registryId);
      if (!source) return [];
      return [
        {
          registryId,
          registryName: source.name,
          jurisdictions: sourceJurisdictions(source),
          contact: toContact(source),
          identifierCount: entries.length,
          identifiers: entries
            .map((entry) => ({
              sourceValue: entry.sourceValue,
              countryCode: entry.countryCode,
              firstDetectedAt: entry.firstDetectedAt,
              lastDetectedAt: entry.lastDetectedAt,
              administeredBy: appointedRegistryFor(entry.countryCode, sources),
            }))
            .sort((left, right) => left.sourceValue.localeCompare(right.sourceValue)),
        },
      ];
    })
    .sort((left, right) => left.registryId.localeCompare(right.registryId));

  return { generatedAt, totalIdentifiers: current.length, registers };
}

function appointedRegistryFor(countryCode: string, sources: SourceDefinition[]) {
  const appointed = sources.find(
    (source) => isAuthoritative(source) && sourceJurisdictions(source).includes(countryCode),
  );
  return appointed ? { sourceId: appointed.id, ...toContact(appointed) } : null;
}

function toContact(source: SourceDefinition): ReportContact {
  return {
    authorityId: source.authority.id,
    authorityName: source.authority.name,
    homepageUrl: source.authority.homepageUrl,
  };
}
