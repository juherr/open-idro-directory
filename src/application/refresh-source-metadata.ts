import { readFile, writeFile } from "node:fs/promises";
import type { SourceDefinition } from "../domain/source-definition.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";
import { toSourceMetadata } from "../infrastructure/serialization/serializers.js";

interface ExistingSourceSummary {
  id: string;
  health: unknown;
}

export async function refreshSourceMetadata(
  sources: SourceDefinition[],
  outputDir = fromRoot("data"),
) {
  const path = `${outputDir}/sources.json`;
  const existing = JSON.parse(await readFile(path, "utf8")) as ExistingSourceSummary[];
  const healthById = new Map(existing.map((source) => [source.id, source.health]));
  const summaries = sources.map((source) => ({
    ...toSourceMetadata(source),
    health: healthById.get(source.id) ?? {
      stale: !source.publication.enabled,
      recordCount: 0,
      lastAttemptedRetrieval: null,
      lastSuccessfulRetrieval: null,
      checksum: null,
      freshness: source.publication.enabled ? "unknown" : "disabled",
      latestErrorSummary: null,
    },
  }));
  await writeFile(path, `${JSON.stringify(summaries, null, 2)}\n`);
  return summaries;
}
