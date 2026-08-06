import { readFile } from "node:fs/promises";
import path from "node:path";
import { createConnector } from "../connectors/index.js";
import type { RegistryConnector } from "../connectors/connector.js";
import type {
  InvalidRegistryHistory,
  InvalidRegistryRecordDetection,
  NormalizedRegistryRecord,
  RejectedSourceRowDetection,
} from "../domain/registry-record.js";
import type { SourceBuildResult } from "../domain/source-result.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { readCurrentSnapshot } from "../infrastructure/filesystem/raw-snapshot.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import { writeDatasets } from "../infrastructure/serialization/serializers.js";
import {
  partitionRecordsByIdentifierValidity,
  toRejectedSourceRows,
} from "../validation/identifier-validator.js";
import { validateRegistry } from "../validation/registry-validator.js";
import { checkSafetyThresholds } from "../validation/safety-thresholds.js";
import { mergeGeneratedRecords } from "./generated-record-merge.js";
import { mergeInvalidRecordHistory } from "./invalid-record-history.js";
import { applyOfficialStatusPolicy } from "./official-status-policy.js";

export interface BuildOptions {
  sourceId?: string;
  generatedAt?: string;
  outputDir?: string;
  dataDir?: string;
  /** Sources whose fetch failed this run, by source id, with the reported reason. */
  fetchErrors?: Record<string, string>;
  createConnector?: (source: SourceDefinition) => RegistryConnector;
}

export async function buildRegistry(sources: SourceDefinition[], options: BuildOptions = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const dataDir = options.dataDir ?? fromRoot("data");
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
  // `registry.json` is several megabytes: read and parse it once for the whole
  // build rather than once per source.
  const publishedRecords = await readGeneratedRecords(dataDir);
  const publishedBySource = new Map<string, NormalizedRegistryRecord[]>();
  for (const record of publishedRecords) {
    const registryId = record.source.registryId;
    publishedBySource.set(registryId, [...(publishedBySource.get(registryId) ?? []), record]);
  }
  const previousRecordsOf = (sourceId: string) => publishedBySource.get(sourceId) ?? [];
  const carriedBySource = new Map<string, NormalizedRegistryRecord[]>();
  for (const record of publishedRecords) {
    const registryId = record.source.registryId;
    if (!carriedIds.has(registryId)) continue;
    records.push(record);
    carriedBySource.set(registryId, [...(carriedBySource.get(registryId) ?? []), record]);
  }

  // Republishing a source keeps its previously generated records and reports the
  // reason, rather than dropping it from the datasets.
  async function carryPreviousRecords(
    sourceId: string,
    message: string,
    code: string,
  ): Promise<SourceBuildResult> {
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
      results.push(await carryPreviousRecords(source.id, fetchError, "SOURCE_FETCH_FAILED"));
      continue;
    }
    const connector = createSourceConnector(source);
    try {
      const snapshot = await readCurrentSnapshot(source.id, path.join(dataDir, "raw"));
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
      if (ingested) rejectedRows.push(...toRejectedSourceRows(source.id, warnings));
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
      });
    } catch (error) {
      results.push(
        await carryPreviousRecords(
          source.id,
          error instanceof Error ? error.message : String(error),
          "SOURCE_BUILD_FAILED",
        ),
      );
    }
  }
  // Sources this run did not rebuild keep the health they were last published
  // with, so a filtered run does not report them as empty and never retrieved.
  for (const source of sources) {
    if (!carriedIds.has(source.id)) continue;
    const health = previousHealth[source.id];
    results.push({
      sourceId: source.id,
      records: carriedBySource.get(source.id) ?? [],
      warnings: [],
      errors: [],
      retrievedAt: health?.lastAttemptedRetrieval ?? null,
      checksum: health?.checksum ?? null,
      stale: health?.stale ?? !source.publication.enabled,
      latestError: health?.latestErrorSummary ?? null,
      lastSuccessfulRetrieval: health?.lastSuccessfulRetrieval ?? null,
    });
  }

  const policyRecords = applyOfficialStatusPolicy(records);
  const policyRecordByKey = new Map(policyRecords.map((record) => [record.key, record]));
  const policyResults = results.map((result) => ({
    ...result,
    records: result.records.map((record) => policyRecordByKey.get(record.key) ?? record),
  }));
  const registryIssues = validateRegistry(policyRecords, sources);
  const invalidHistory = mergeInvalidRecordHistory(
    await readPreviousInvalidHistory(dataDir),
    { records: invalidRecords, rows: rejectedRows },
    generatedAt,
  );
  await writeDatasets(
    policyRecords,
    sources,
    policyResults,
    generatedAt,
    options.outputDir,
    invalidHistory,
  );
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
    records: policyRecords,
    invalidHistory,
    results: policyResults,
    issues: registryIssues,
  };
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

interface PublishedSourceHealth {
  stale: boolean;
  lastAttemptedRetrieval: string | null;
  lastSuccessfulRetrieval: string | null;
  checksum: string | null;
  latestErrorSummary: string | null;
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
