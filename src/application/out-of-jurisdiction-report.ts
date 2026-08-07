import type { InvalidRegistryHistory } from "../domain/registry-record.js";
import type { AuthorityDefinition } from "../domain/authority-definition.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "../domain/source-definition.js";
import { coversJurisdiction } from "../validation/identifier-scope.js";

interface OutOfJurisdictionFinding {
  sourceValue: string;
  countryCode: string;
  firstDetectedAt: string;
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
 * Turns the out-of-jurisdiction findings into something an editor can act on:
 * grouped by the register that publishes them, with the organisation to write
 * to and, for each identifier, the register appointed for that country.
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
  const current = invalid.outOfJurisdiction.filter(
    (entry) => entry.lastDetectedAt === generatedAt && sourceById.has(entry.registryId),
  );
  const registers = [...Map.groupBy(current, (entry) => entry.registryId)]
    .map(([registryId, entries]) => {
      // Present because `current` kept only the entries whose register is known.
      const source = sourceById.get(registryId) as SourceDefinition;
      return {
        registryId,
        registryName: source.name,
        jurisdictions: sourceJurisdictions(source),
        authority: source.authority,
        identifiers: entries
          .map((entry) => ({
            sourceValue: entry.sourceValue,
            countryCode: entry.countryCode,
            firstDetectedAt: entry.firstDetectedAt,
            lastDetectedAt: entry.lastDetectedAt,
            administeredBy: appointedRegisterFor(entry.countryCode, sources),
          }))
          .sort((left, right) => left.sourceValue.localeCompare(right.sourceValue)),
      };
    })
    .sort((left, right) => left.registryId.localeCompare(right.registryId));

  return { generatedAt, totalIdentifiers: current.length, registers };
}

function appointedRegisterFor(countryCode: string, sources: SourceDefinition[]) {
  const appointed = sources.find(
    (source) => isAuthoritative(source) && coversJurisdiction(source, countryCode),
  );
  return appointed ? { registryId: appointed.id, authority: appointed.authority } : null;
}
