import path from "node:path";
import { createConnector as createRegistryConnector } from "../connectors/index.js";
import type { FetchResult, RegistryConnector } from "../connectors/connector.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import {
  preserveRawSnapshot,
  readCurrentSnapshot,
} from "../infrastructure/filesystem/raw-snapshot.js";

export interface SourceFetchFailure {
  status: "failed";
  sourceId: string;
  error: string;
}

export type SourceFetchOutcome = FetchResult | SourceFetchFailure;

export interface FetchSourcesOptions {
  sourceId?: string;
  owner?: string;
  dataDir?: string;
  createConnector?: (source: SourceDefinition) => RegistryConnector;
}

export function isFetchFailure(outcome: SourceFetchOutcome): outcome is SourceFetchFailure {
  return outcome.status === "failed";
}

export async function fetchSources(sources: SourceDefinition[], options: FetchSourcesOptions = {}) {
  const retrievedAt = new Date().toISOString();
  const selected = sources.filter(
    (source) => source.publication.enabled && (!options.sourceId || source.id === options.sourceId),
  );
  const rawDir = path.join(options.dataDir ?? fromRoot("data"), "raw");
  const createConnector = options.createConnector ?? createRegistryConnector;
  const userAgent = `open-idro-directory/0.1 (+https://github.com/${options.owner ?? "OWNER"}/open-idro-directory)`;
  const results: SourceFetchOutcome[] = [];
  for (const source of selected) {
    const connector = createConnector(source);
    const previous = await readCurrentSnapshot(source.id, rawDir).catch(() => null);
    const context = {
      source,
      retrievedAt,
      userAgent,
      ...(previous?.metadata.etag ? { previousEtag: previous.metadata.etag } : {}),
      ...(previous?.metadata.lastModified
        ? { previousLastModified: previous.metadata.lastModified }
        : {}),
    };
    // One registry being unreachable is an outage of that registry, not of the
    // run: the remaining sources are still fetched, and the build decides what
    // to publish for the source that failed.
    let result: FetchResult;
    try {
      result = await connector.fetch(context);
    } catch (error) {
      results.push({
        status: "failed",
        sourceId: source.id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const unchangedByChecksum =
      result.status === "changed" && previous?.metadata.checksum === result.checksum;
    if (result.status === "changed" && !unchangedByChecksum)
      await preserveRawSnapshot(result, rawDir);
    results.push(unchangedByChecksum ? { ...result, status: "unchanged" as const } : result);
  }
  return results;
}
