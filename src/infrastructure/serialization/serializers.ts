import { mkdir, writeFile } from "node:fs/promises";
import { fromRoot } from "../filesystem/paths.js";
import { isValidEmi3Identifier } from "../../domain/emi3-identifier.js";
import type {
  InvalidRegistryHistory,
  NormalizedRegistryRecord,
} from "../../domain/registry-record.js";
import type { SourceBuildResult } from "../../domain/source-result.js";
import {
  isAuthoritative,
  sourceJurisdictions,
  type SourceDefinition,
} from "../../domain/source-definition.js";

/**
 * The health block of `data/sources.json`, declared once so that a later run
 * reading what was published cannot drift from what this module writes.
 */
export interface PublishedSourceHealth {
  stale: boolean;
  recordCount: number;
  lastAttemptedRetrieval: string | null;
  lastSuccessfulRetrieval: string | null;
  checksum: string | null;
  freshness: string;
  latestErrorSummary: string | null;
}

export interface GeneratedStats {
  totalRecords: number;
  totalInvalidRecords: number;
  totalRejectedRows: number;
  totalOutOfJurisdictionRows: number;
  recordsByCountry: Record<string, number>;
  recordsByCountryRole: Record<string, Record<string, number>>;
  recordsByRole: Record<string, number>;
  recordsByStatus: Record<string, number>;
  recordsByRegistry: Record<string, number>;
  invalidRecordsByReason: Record<string, number>;
  invalidRecordsByRegistry: Record<string, number>;
  rejectedRowsByRegistry: Record<string, number>;
  outOfJurisdictionByRegistry: Record<string, number>;
  outOfJurisdictionByCountry: Record<string, number>;
  staleSources: string[];
  generatedAt: string;
}

export async function writeDatasets(
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
  results: SourceBuildResult[],
  generatedAt: string,
  outputDir = fromRoot("data"),
  invalid: InvalidRegistryHistory = { generatedAt, records: [], rows: [], outOfJurisdiction: [] },
) {
  await mkdir(outputDir, { recursive: true });
  const sorted = sortRecords(records);
  // Last line of defence: the published datasets are written before
  // `validateRegistry` can throw, so a regression must not reach disk.
  const published = sorted.find((record) => !isValidEmi3Identifier(record));
  if (published) {
    throw new Error(`Refusing to publish record with an invalid eMI3 identifier: ${published.key}`);
  }
  await writeFile(`${outputDir}/registry.json`, `${JSON.stringify(sorted, null, 2)}\n`);
  await writeFile(`${outputDir}/registry.min.json`, JSON.stringify(sorted));
  await writeFile(
    `${outputDir}/registry.ndjson`,
    sorted.map((record) => JSON.stringify(record)).join("\n") + "\n",
  );
  await writeFile(`${outputDir}/registry.csv`, toCsv(sorted));
  await writeFile(`${outputDir}/registry-invalid.json`, `${JSON.stringify(invalid, null, 2)}\n`);
  await writeFile(
    `${outputDir}/sources.json`,
    `${JSON.stringify(toSourcesSummary(sources, results), null, 2)}\n`,
  );
  await writeFile(
    `${outputDir}/stats.json`,
    `${JSON.stringify(toStats(sorted, invalid, results, generatedAt), null, 2)}\n`,
  );
}

export function sortRecords(records: NormalizedRegistryRecord[]) {
  return [...records].sort(compareRecords);
}

function compareRecords(a: NormalizedRegistryRecord, b: NormalizedRegistryRecord) {
  return (
    a.countryCode.localeCompare(b.countryCode) ||
    a.partyId.localeCompare(b.partyId) ||
    a.role.localeCompare(b.role) ||
    a.source.registryId.localeCompare(b.source.registryId)
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
    const health: PublishedSourceHealth = {
      stale: result?.stale ?? !source.publication.enabled,
      recordCount: result?.records.length ?? 0,
      lastAttemptedRetrieval: result?.retrievedAt ?? null,
      lastSuccessfulRetrieval: result?.lastSuccessfulRetrieval ?? null,
      checksum: result?.checksum ?? null,
      freshness: result?.stale ? "stale" : source.publication.enabled ? "current" : "disabled",
      latestErrorSummary: result?.latestError ?? null,
    };
    return { ...toSourceMetadata(source), health };
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
  invalid: InvalidRegistryHistory,
  results: SourceBuildResult[],
  generatedAt: string,
): GeneratedStats {
  // The history keeps every identifier ever refused; the counters describe only
  // what the sources still publish, so a corrected identifier stops being
  // reported as a current problem.
  const currentRecords = invalid.records.filter((entry) => entry.lastDetectedAt === generatedAt);
  const currentRows = invalid.rows.filter((entry) => entry.lastDetectedAt === generatedAt);
  const currentForeign = (invalid.outOfJurisdiction ?? []).filter(
    (entry) => entry.lastDetectedAt === generatedAt,
  );
  return {
    totalRecords: records.length,
    totalInvalidRecords: currentRecords.length,
    totalRejectedRows: currentRows.length,
    totalOutOfJurisdictionRows: currentForeign.length,
    recordsByCountry: countBy(records, (record) => record.countryCode),
    recordsByCountryRole: countByCountryRole(records),
    recordsByRole: countBy(records, (record) => record.role),
    recordsByStatus: countBy(records, (record) => record.status),
    recordsByRegistry: countBy(records, (record) => record.source.registryId),
    invalidRecordsByReason: countBy(
      currentRecords.flatMap((entry) => entry.reasons),
      (reason) => reason,
    ),
    invalidRecordsByRegistry: countBy(currentRecords, (entry) => entry.record.source.registryId),
    rejectedRowsByRegistry: countBy(currentRows, (row) => row.registryId),
    // Grouped by register to know who to tell, and by country to know which
    // appointed registry the identifier actually belongs to.
    outOfJurisdictionByRegistry: countBy(currentForeign, (row) => row.registryId),
    outOfJurisdictionByCountry: countBy(currentForeign, (row) => row.countryCode),
    staleSources: results
      .filter((result) => result.stale)
      .map((result) => result.sourceId)
      .sort(),
    generatedAt,
  };
}

function countBy<TItem>(items: TItem[], selector: (item: TItem) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) counts[selector(item)] = (counts[selector(item)] ?? 0) + 1;
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
