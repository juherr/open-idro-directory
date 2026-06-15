import { createConnector } from "../connectors/index.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import {
  preserveRawSnapshot,
  readCurrentSnapshot,
} from "../infrastructure/filesystem/raw-snapshot.js";

export async function fetchSources(
  sources: SourceDefinition[],
  options: { sourceId?: string; owner?: string } = {},
) {
  const retrievedAt = new Date().toISOString();
  const selected = sources.filter(
    (source) => source.enabled && (!options.sourceId || source.id === options.sourceId),
  );
  const userAgent = `open-idro-directory/0.1 (+https://github.com/${options.owner ?? "OWNER"}/open-idro-directory)`;
  const results = [];
  for (const source of selected) {
    const connector = createConnector(source);
    const previous = await readCurrentSnapshot(source.id).catch(() => null);
    const context = {
      source,
      retrievedAt,
      userAgent,
      ...(previous?.metadata.etag ? { previousEtag: previous.metadata.etag } : {}),
      ...(previous?.metadata.lastModified
        ? { previousLastModified: previous.metadata.lastModified }
        : {}),
    };
    const result = await connector.fetch(context);
    const unchangedByChecksum =
      result.status === "changed" && previous?.metadata.checksum === result.checksum;
    if (result.status === "changed" && !unchangedByChecksum) await preserveRawSnapshot(result);
    results.push(unchangedByChecksum ? { ...result, status: "unchanged" as const } : result);
  }
  return results;
}
