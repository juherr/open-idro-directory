import { mkdir, writeFile } from "node:fs/promises";
import { fromRoot } from "../filesystem/paths.js";
import type { NormalizedRegistryRecord } from "../../domain/registry-record.js";
import type { SourceBuildResult } from "../../domain/source-result.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "../../domain/source-definition.js";

export interface GeneratedStats {
  totalRecords: number;
  recordsByCountry: Record<string, number>;
  recordsByCountryRole: Record<string, Record<string, number>>;
  recordsByRole: Record<string, number>;
  recordsByStatus: Record<string, number>;
  recordsByRegistry: Record<string, number>;
  staleSources: string[];
  generatedAt: string;
}

export async function writeDatasets(
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
  results: SourceBuildResult[],
  generatedAt: string,
  outputDir = fromRoot("data"),
) {
  await mkdir(outputDir, { recursive: true });
  const sorted = sortRecords(records);
  await writeFile(`${outputDir}/registry.json`, `${JSON.stringify(sorted, null, 2)}\n`);
  await writeFile(`${outputDir}/registry.min.json`, JSON.stringify(sorted));
  await writeFile(
    `${outputDir}/registry.ndjson`,
    sorted.map((record) => JSON.stringify(record)).join("\n") + "\n",
  );
  await writeFile(`${outputDir}/registry.csv`, toCsv(sorted));
  await writeFile(
    `${outputDir}/sources.json`,
    `${JSON.stringify(toSourcesSummary(sources, results), null, 2)}\n`,
  );
  await writeFile(
    `${outputDir}/stats.json`,
    `${JSON.stringify(toStats(sorted, results, generatedAt), null, 2)}\n`,
  );
}

export function sortRecords(records: NormalizedRegistryRecord[]) {
  return [...records].sort(
    (a, b) =>
      a.countryCode.localeCompare(b.countryCode) ||
      a.partyId.localeCompare(b.partyId) ||
      a.role.localeCompare(b.role) ||
      a.source.registryId.localeCompare(b.source.registryId),
  );
}

function toCsv(records: NormalizedRegistryRecord[]) {
  const columns = [
    "key",
    "countryCode",
    "partyId",
    "eMobilityId",
    "role",
    "status",
    "organizationName",
    "legalName",
    "website",
    "registryId",
    "official",
    "sourceRecordId",
    "sourceUrl",
    "sourceValue",
    "firstSeenAt",
    "lastSeenAt",
    "retrievedAt",
  ];
  const rows = records.map((record) =>
    [
      record.key,
      record.countryCode,
      record.partyId,
      record.eMobilityId,
      record.role,
      record.status,
      record.organization.name,
      record.organization.legalName ?? "",
      record.organization.website ?? "",
      record.source.registryId,
      String(record.source.official),
      record.source.sourceRecordId ?? "",
      record.source.sourceUrl,
      record.source.sourceValue,
      record.source.firstSeenAt,
      record.source.lastSeenAt,
      record.source.retrievedAt,
    ].map(csvCell),
  );
  return [columns.join(","), ...rows.map((row) => row.join(","))].join("\n") + "\n";
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function toSourcesSummary(sources: SourceDefinition[], results: SourceBuildResult[]) {
  const resultById = new Map(results.map((result) => [result.sourceId, result]));
  return sources.map((source) => {
    const result = resultById.get(source.id);
    return {
      ...toSourceMetadata(source),
      health: {
        stale: result?.stale ?? !source.publication.enabled,
        recordCount: result?.records.length ?? 0,
        lastAttemptedRetrieval: result?.retrievedAt ?? null,
        lastSuccessfulRetrieval: result && !result.latestError ? result.retrievedAt : null,
        checksum: result?.checksum ?? null,
        freshness: result?.stale ? "stale" : source.publication.enabled ? "current" : "disabled",
        latestErrorSummary: result?.latestError ?? null,
      },
    };
  });
}

export function toSourceMetadata(source: SourceDefinition) {
  return {
    id: source.id,
    name: source.name,
    authority: source.authority,
    registry: {
      url: source.registry.url,
      observationType: source.registry.observationType,
      supportedRoles: source.registry.supportedRoles,
      jurisdictions: sourceJurisdictions(source),
    },
    publication: {
      connector: source.publication.connector,
      machineReadableUrl: source.publication.machineReadableUrl,
      refreshSchedule: source.publication.refreshSchedule,
      enabled: source.publication.enabled,
      verifiedAt: source.publication.verifiedAt,
    },
    // Derived from authority.level, kept so consumers of the previous shape and
    // the public API keep a single-field answer to "is this the appointed IDRO".
    official: isAuthoritative(source),
    reuse: source.reuse,
  };
}

function toStats(
  records: NormalizedRegistryRecord[],
  results: SourceBuildResult[],
  generatedAt: string,
): GeneratedStats {
  return {
    totalRecords: records.length,
    recordsByCountry: countBy(records, (record) => record.countryCode),
    recordsByCountryRole: countByCountryRole(records),
    recordsByRole: countBy(records, (record) => record.role),
    recordsByStatus: countBy(records, (record) => record.status),
    recordsByRegistry: countBy(records, (record) => record.source.registryId),
    staleSources: results
      .filter((result) => result.stale)
      .map((result) => result.sourceId)
      .sort(),
    generatedAt,
  };
}

function countBy(
  records: NormalizedRegistryRecord[],
  selector: (record: NormalizedRegistryRecord) => string,
) {
  const counts: Record<string, number> = {};
  for (const record of records) counts[selector(record)] = (counts[selector(record)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function countByCountryRole(records: NormalizedRegistryRecord[]) {
  const counts: Record<string, Record<string, number>> = {};
  for (const record of records) {
    const countryCounts = (counts[record.countryCode] ??= {});
    countryCounts[record.role] = (countryCounts[record.role] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([countryCode, roleCounts]) => [
        countryCode,
        Object.fromEntries(Object.entries(roleCounts).sort(([a], [b]) => a.localeCompare(b))),
      ]),
  );
}
