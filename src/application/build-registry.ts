import { readFile } from "node:fs/promises";
import { createConnector } from "../connectors/index.js";
import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { SourceBuildResult } from "../domain/source-result.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { readCurrentSnapshot } from "../infrastructure/filesystem/raw-snapshot.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import { writeDatasets } from "../infrastructure/serialization/serializers.js";
import { validateRegistry } from "../validation/registry-validator.js";
import { checkSafetyThresholds } from "../validation/safety-thresholds.js";
import { applyOfficialStatusPolicy } from "./official-status-policy.js";

export interface BuildOptions {
  sourceId?: string;
  generatedAt?: string;
  outputDir?: string;
}

export async function buildRegistry(sources: SourceDefinition[], options: BuildOptions = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const selected = sources.filter(
    (source) => source.enabled && (!options.sourceId || source.id === options.sourceId),
  );
  const results: SourceBuildResult[] = [];
  const records: NormalizedRegistryRecord[] = [];
  for (const source of selected) {
    const connector = createConnector(source);
    try {
      const snapshot = await readCurrentSnapshot(source.id);
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
      const previous = await readPreviousGeneratedRecords(source.id);
      const safety = checkSafetyThresholds(
        source,
        previous,
        normalized.records,
        parsed.errors.length,
        snapshot.body,
      );
      const errors = [...parsed.errors, ...normalized.errors, ...safety];
      const resultRecords = errors.some((issue) => issue.severity === "error")
        ? previous
        : normalized.records;
      records.push(...resultRecords);
      results.push({
        sourceId: source.id,
        records: resultRecords,
        warnings: [...parsed.warnings, ...normalized.warnings],
        errors,
        retrievedAt: snapshot.metadata.retrievedAt,
        checksum: snapshot.metadata.checksum,
        stale: errors.length > 0,
        latestError: errors[0]?.message ?? null,
      });
    } catch (error) {
      const previous = await readPreviousGeneratedRecords(source.id);
      records.push(...previous);
      results.push({
        sourceId: source.id,
        records: previous,
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "SOURCE_BUILD_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
        retrievedAt: null,
        checksum: null,
        stale: true,
        latestError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const policyRecords = applyOfficialStatusPolicy(records);
  const policyRecordByKey = new Map(policyRecords.map((record) => [record.key, record]));
  const policyResults = results.map((result) => ({
    ...result,
    records: result.records.map((record) => policyRecordByKey.get(record.key) ?? record),
  }));
  const registryIssues = validateRegistry(policyRecords, sources);
  await writeDatasets(policyRecords, sources, policyResults, generatedAt, options.outputDir);
  if (registryIssues.some((issue) => issue.severity === "error")) {
    throw new Error(
      `Registry validation failed: ${registryIssues.map((issue) => issue.message).join("; ")}`,
    );
  }
  if (results.some((result) => result.errors.length > 0)) {
    throw new Error(
      `One or more sources failed: ${results
        .map((result) => result.latestError)
        .filter(Boolean)
        .join("; ")}`,
    );
  }
  return { records: policyRecords, results: policyResults, issues: registryIssues };
}

async function readPreviousGeneratedRecords(sourceId: string): Promise<NormalizedRegistryRecord[]> {
  try {
    const raw = await readFile(fromRoot("data", "registry.json"), "utf8");
    const records = JSON.parse(raw) as NormalizedRegistryRecord[];
    return records.filter((record) => record.source.registryId === sourceId);
  } catch {
    return [];
  }
}
