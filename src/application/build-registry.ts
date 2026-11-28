import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createConnector } from "../connectors/index.js";
import type { ConnectorFactory } from "../connectors/connector.js";
import type {
  InvalidRegistryHistory,
  InvalidRegistryRecordDetection,
  NormalizedRegistryRecord,
  RejectedSourceRowDetection,
} from "../domain/registry-record.js";
import {
  classifyIdentifierProvenance,
  withIssuingProvenance,
  withoutIssuingProvenance,
} from "../domain/identifier-provenance.js";
import { withPublishedObservations } from "../domain/registry-observation.js";
import type { SourceBuildResult } from "../domain/source-result.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { rawSnapshotDir, readCurrentSnapshot } from "../infrastructure/filesystem/raw-snapshot.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import {
  writeDatasets,
  type PublishedSourceHealth,
} from "../infrastructure/serialization/serializers.js";
import {
  partitionRecordsByIdentifierValidity,
  toRejectedSourceRows,
} from "../validation/identifier-validator.js";
import { validateRegistry } from "../validation/registry-validator.js";
import { checkSafetyThresholds } from "../validation/safety-thresholds.js";
import { mergeGeneratedRecords } from "./generated-record-merge.js";
import { buildOutOfJurisdictionReport } from "./out-of-jurisdiction-report.js";
import { currentDetections, mergeInvalidRecordHistory } from "./invalid-record-history.js";
import {
  buildDiscrepancyReport,
  readDuplicateFindings,
  readMalformedFindings,
  type DiscrepancyReport,
  type DuplicateObservation,
} from "./discrepancy-report.js";
import { issuingHealthBySourceId, issuingSourceHealth } from "./issuing-source-health.js";
import { applyOfficialStatusPolicy } from "./official-status-policy.js";

export interface BuildOptions {
  sourceId?: string;
  generatedAt?: string;
  outputDir?: string;
  dataDir?: string;
  /** Sources whose fetch failed this run, by source id, with the reported reason. */
  fetchErrors?: Record<string, string>;
  createConnector?: ConnectorFactory;
}

export async function buildRegistry(sources: SourceDefinition[], options: BuildOptions = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const dataDir = options.dataDir ?? fromRoot("data");
  const outputDir = options.outputDir ?? dataDir;
  const selected = sources.filter(
    (source) => source.publication.enabled && (!options.sourceId || source.id === options.sourceId),
  );
  // Without this, a mistyped or disabled `--source` rebuilds nothing, republishes
  // everything, and reports success: the run looks like it did the work it was
  // asked for.
  if (options.sourceId && selected.length === 0) {
    throw new Error(`No enabled source matches ${options.sourceId}.`);
  }
  const createSourceConnector = options.createConnector ?? createConnector;
  const results: SourceBuildResult[] = [];
  const records: NormalizedRegistryRecord[] = [];
  const invalidRecords: InvalidRegistryRecordDetection[] = [];
  const rejectedRows: RejectedSourceRowDetection[] = [];
  // The datasets are global. A run restricted to one source must therefore
  // republish what the other sources published last time, or writing the
  // datasets would drop them from the registry.
  const selectedIds = new Set(selected.map((source) => source.id));
  // Only a source that is still published but was filtered out of this run is
  // carried. Disabling a source, or removing its descriptor, must keep removing
  // its records from the datasets.
  const carriedIds = new Set(
    sources
      .filter((source) => source.publication.enabled && !selectedIds.has(source.id))
      .map((source) => source.id),
  );
  const previousHealth = await readPreviousSourceHealth(dataDir);
  // `registry.json` is several megabytes: read, parse, and group it once for the
  // whole build rather than once per source. Records published before the
  // observation block existed get it here, so the safety thresholds and the
  // merge compare like with like. The issuing block is dropped: this build
  // derives it again from every source.
  const publishedBySource = Map.groupBy(
    withPublishedObservations(await readGeneratedRecords(dataDir), sources).map(
      withoutIssuingProvenance,
    ),
    (record) => record.source.registryId,
  );
  const previousRecordsOf = (sourceId: string) => publishedBySource.get(sourceId) ?? [];
  for (const sourceId of carriedIds) records.push(...previousRecordsOf(sourceId));

  // Republishing a source keeps its previously generated records and reports the
  // reason, rather than dropping it from the datasets.
  function carryPreviousRecords(
    sourceId: string,
    message: string,
    code: string,
  ): SourceBuildResult {
    const previous = previousRecordsOf(sourceId);
    const publishable = partitionRecordsByIdentifierValidity(previous);
    records.push(...publishable.valid);
    invalidRecords.push(...publishable.invalid);
    return {
      sourceId,
      records: publishable.valid,
      warnings: [],
      errors: [{ severity: "error", code, message }],
      retrievedAt: generatedAt,
      checksum: previousHealth[sourceId]?.checksum ?? null,
      stale: true,
      latestError: message,
      lastSuccessfulRetrieval: previousHealth[sourceId]?.lastSuccessfulRetrieval ?? null,
    };
  }

  for (const source of selected) {
    const fetchError = options.fetchErrors?.[source.id];
    if (fetchError) {
      // A source we could not reach must not be re-ingested from its previous
      // snapshot as if it were fresh: it keeps its records and is reported stale.
      results.push(carryPreviousRecords(source.id, fetchError, "SOURCE_FETCH_FAILED"));
      continue;
    }
    const connector = createSourceConnector(source);
    try {
      const snapshot = await readCurrentSnapshot(source.id, rawSnapshotDir(dataDir));
      const parsed = await connector.parse({
        source,
        body: snapshot.body,
        retrievedAt: snapshot.metadata.retrievedAt,
      });
      const normalized = await connector.normalize({
        source,
        records: parsed.records,
        retrievedAt: snapshot.metadata.retrievedAt,
      });
      const previous = previousRecordsOf(source.id);
      const safetyPrevious = filterSourcePresentRecords(previous);
      const safety = checkSafetyThresholds(
        source,
        safetyPrevious,
        normalized.records,
        parsed.errors.length,
        snapshot.body,
      );
      const errors = [...parsed.errors, ...normalized.errors, ...safety];
      const ingested = !errors.some((issue) => issue.severity === "error");
      const resultRecords = ingested
        ? mergeGeneratedRecords(source, previous, normalized.records, snapshot.metadata.retrievedAt)
        : previous;
      const warnings = [...parsed.warnings, ...normalized.warnings];
      // Rows the connector could not turn into an identifier are only reported
      // when this run was actually ingested. A failed source republishes its
      // previous records, so its discarded rows would describe nothing.
      if (ingested) {
        rejectedRows.push(...toRejectedSourceRows(source.id, warnings));
      }
      // Partitioning after the merge also cleans records carried over from the
      // previous dataset, which is where retained tombstones come from. Safety
      // thresholds keep comparing unfiltered connector output, so an exclusion
      // can never be mistaken for an upstream mass deletion.
      const publishable = partitionRecordsByIdentifierValidity(resultRecords);
      records.push(...publishable.valid);
      invalidRecords.push(...publishable.invalid);
      results.push({
        sourceId: source.id,
        records: publishable.valid,
        warnings,
        errors,
        retrievedAt: snapshot.metadata.retrievedAt,
        checksum: snapshot.metadata.checksum,
        stale: errors.length > 0,
        latestError: errors[0]?.message ?? null,
        // The registry answered: the snapshot is this run's. A build that failed
        // afterwards keeps saying so through `stale` and `latestError`.
        lastSuccessfulRetrieval: snapshot.metadata.retrievedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(carryPreviousRecords(source.id, message, "SOURCE_BUILD_FAILED"));
    }
  }
  // Sources this run did not rebuild keep the health they were last published
  // with, so a filtered run does not report them as empty and never retrieved.
  for (const sourceId of carriedIds) {
    const health = previousHealth[sourceId];
    results.push({
      sourceId,
      records: previousRecordsOf(sourceId),
      warnings: [],
      errors: [],
      retrievedAt: health?.lastAttemptedRetrieval ?? null,
      checksum: health?.checksum ?? null,
      stale: health?.stale ?? false,
      latestError: health?.latestErrorSummary ?? null,
      lastSuccessfulRetrieval: health?.lastSuccessfulRetrieval ?? null,
    });
  }

  // Carried sources' results come from their published health, so a partial
  // update classifies against the same health a full build published.
  const policyRecords = applyOfficialStatusPolicy(records);
  const classifiedRecords = withIssuingProvenance(
    policyRecords,
    classifyIdentifierProvenance(policyRecords, sources, issuingHealthBySourceId(results)),
  );
  const classifiedRecordByKey = new Map(classifiedRecords.map((record) => [record.key, record]));
  const policyResults = results.map((result) => ({
    ...result,
    records: result.records.map((record) => classifiedRecordByKey.get(record.key) ?? record),
  }));
  const registryIssues = validateRegistry(classifiedRecords, sources);
  const invalidHistory = mergeInvalidRecordHistory(
    await readPreviousInvalidHistory(dataDir),
    { records: invalidRecords, rows: rejectedRows },
    generatedAt,
  );
  await writeDatasets(
    classifiedRecords,
    sources,
    policyResults,
    generatedAt,
    outputDir,
    invalidHistory,
  );
  // Only a full run writes the report, as before listings replaced the
  // rejection history it was read from.
  if (!options.sourceId) {
    await writeOutOfJurisdictionReport(outputDir, classifiedRecords, sources, generatedAt);
  }
  // Every run writes it: carried sources keep their published health,
  // duplicate and malformed findings, so a partial run reports what a full one
  // would.
  const previousReport = await readPreviousReport(dataDir);
  const notIngested = notIngestedSourceIds(results, selectedIds);
  const discrepancies = buildDiscrepancyReport({
    records: classifiedRecords,
    sources,
    health: Object.fromEntries(
      results.map((result) => [
        result.sourceId,
        {
          state: issuingSourceHealth(result),
          lastSuccessfulRetrieval: result.lastSuccessfulRetrieval,
        },
      ]),
    ),
    invalidHistory: currentMalformed(invalidHistory, previousReport, notIngested),
    duplicates: duplicateObservations(previousReport, results, notIngested),
    generatedAt,
  });
  await writeReport(outputDir, "discrepancies.json", discrepancies);
  if (registryIssues.some((issue) => issue.severity === "error")) {
    throw new Error(
      `Registry validation failed: ${registryIssues.map((issue) => issue.message).join("; ")}`,
    );
  }
  // A single registry being down is reported, not fatal: the datasets are still
  // published, the failing source stays stale with its previous records, and the
  // caller surfaces it. Only losing every selected source means this run
  // produced nothing worth trusting.
  const rebuilt = policyResults.filter((result) => selectedIds.has(result.sourceId));
  const failed = rebuilt.filter((result) => result.errors.length > 0);
  if (rebuilt.length > 0 && failed.length === rebuilt.length) {
    throw new Error(
      `Every selected source failed: ${failed
        .map((result) => `${result.sourceId}: ${result.latestError}`)
        .join("; ")}`,
    );
  }
  return {
    records: classifiedRecords,
    invalidHistory,
    results: policyResults,
    issues: registryIssues,
    discrepancies,
    rebuiltSourceIds: [...selectedIds],
  };
}

async function writeOutOfJurisdictionReport(
  outputDir: string,
  records: NormalizedRegistryRecord[],
  sources: SourceDefinition[],
  generatedAt: string,
) {
  await writeReport(
    outputDir,
    "out-of-jurisdiction.json",
    buildOutOfJurisdictionReport(records, sources, generatedAt),
  );
}

async function writeReport(outputDir: string, fileName: string, report: unknown) {
  const reportsDir = path.join(outputDir, "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, fileName), `${JSON.stringify(report, null, 2)}\n`);
}

/**
 * A source ingested this run reports the duplicates its connector raised now.
 * Any other source, carried or republished after a failure, keeps the
 * duplicate findings it was last published with.
 */
function duplicateObservations(
  previousReport: unknown,
  results: readonly SourceBuildResult[],
  carriedIds: ReadonlySet<string>,
): DuplicateObservation[] {
  return [
    ...results
      .filter((result) => !carriedIds.has(result.sourceId))
      .flatMap((result) =>
        result.warnings
          .filter((warning) => warning.code.endsWith("_DUPLICATE_IDENTIFIER"))
          .map((warning) => ({
            sourceId: result.sourceId,
            code: warning.code,
            message: warning.message,
            retrievedAt: result.retrievedAt,
          })),
      ),
    ...fromPreviousReport(previousReport, readDuplicateFindings).filter((duplicate) =>
      carriedIds.has(duplicate.sourceId),
    ),
  ];
}

/**
 * The sources of this run that were not ingested in it: carried by a partial
 * run, or republished after a failure. Only a source still in this run counts:
 * a disabled source, or one whose descriptor was removed, has no result and
 * loses its findings with its data.
 */
function notIngestedSourceIds(
  results: readonly SourceBuildResult[],
  selectedIds: ReadonlySet<string>,
): Set<string> {
  const isIngested = (result: SourceBuildResult) =>
    selectedIds.has(result.sourceId) && !result.errors.some((issue) => issue.severity === "error");
  return new Set(results.filter((result) => !isIngested(result)).map((result) => result.sourceId));
}

/**
 * The exclusion-history entries the report presents as current. A source
 * ingested this run reports what this run detected; any other source keeps the
 * malformed findings it was last published with, so an entry its source has
 * since corrected or dropped is not reported again. The history itself, in
 * `registry-invalid.json`, keeps every entry with its detection dates.
 */
function currentMalformed(
  history: InvalidRegistryHistory,
  previousReport: unknown,
  carriedIds: ReadonlySet<string>,
): Pick<InvalidRegistryHistory, "records" | "rows"> {
  const published = fromPreviousReport(previousReport, readMalformedFindings).filter((finding) =>
    carriedIds.has(finding.registryId),
  );
  const publishedRecords = new Set(published.map((finding) => finding.recordKey));
  const rowKey = (registryId: string, sourceValue: string | null) =>
    JSON.stringify([registryId, sourceValue]);
  const publishedRows = new Set(
    published
      .filter((finding) => finding.recordKey === null)
      .map((finding) => rowKey(finding.registryId, finding.sourceValue)),
  );
  const current = currentDetections(history);
  const currentRecords = new Set(current.records);
  const currentRows = new Set(current.rows);
  return {
    records: history.records.filter(
      (entry) =>
        currentRecords.has(entry) ||
        (carriedIds.has(entry.record.source.registryId) && publishedRecords.has(entry.record.key)),
    ),
    rows: history.rows.filter(
      (entry) =>
        currentRows.has(entry) ||
        (carriedIds.has(entry.registryId) &&
          publishedRows.has(rowKey(entry.registryId, entry.sourceValue))),
    ),
  };
}

// The previously published report, or `null` when there is none or it cannot
// be read.
async function readPreviousReport(dataDir: string): Promise<unknown> {
  try {
    return JSON.parse(
      await readFile(path.join(dataDir, "reports", "discrepancies.json"), "utf8"),
    ) as unknown;
  } catch {
    return null;
  }
}

// What `read` finds in the previous report; nothing when there is no report or
// it does not have the expected shape.
function fromPreviousReport<T>(report: unknown, read: (report: DiscrepancyReport) => T[]): T[] {
  if (report === null) return [];
  try {
    return read(report as DiscrepancyReport);
  } catch {
    return [];
  }
}

// Hand-written `supersededBy` annotations live in this file, so the build reads
// it back rather than regenerating it from scratch.
async function readPreviousInvalidHistory(dataDir: string): Promise<InvalidRegistryHistory | null> {
  try {
    const raw = await readFile(path.join(dataDir, "registry-invalid.json"), "utf8");
    return JSON.parse(raw) as InvalidRegistryHistory;
  } catch {
    return null;
  }
}

async function readGeneratedRecords(dataDir: string): Promise<NormalizedRegistryRecord[]> {
  try {
    const raw = await readFile(path.join(dataDir, "registry.json"), "utf8");
    return JSON.parse(raw) as NormalizedRegistryRecord[];
  } catch {
    return [];
  }
}

async function readPreviousSourceHealth(
  dataDir: string,
): Promise<Record<string, PublishedSourceHealth>> {
  try {
    const raw = await readFile(path.join(dataDir, "sources.json"), "utf8");
    const summaries = JSON.parse(raw) as { id: string; health: PublishedSourceHealth }[];
    return Object.fromEntries(summaries.map((summary) => [summary.id, summary.health]));
  } catch {
    return {};
  }
}

export function filterSourcePresentRecords(records: NormalizedRegistryRecord[]) {
  return records.filter((record) => record.source.lastSeenAt === record.source.retrievedAt);
}
