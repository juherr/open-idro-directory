import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { fetchSources } from "../../src/application/fetch-sources.js";
import type { FetchContext, RegistryConnector } from "../../src/connectors/connector.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("fetchSources", () => {
  it("keeps fetching the remaining sources after one of them fails", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "open-idro-fetch-"));
    try {
      const sources = [
        await loadSourceDefinition("fr-afirev"),
        await loadSourceDefinition("dk-fstyr"),
      ];
      const outcomes = await fetchSources(sources, {
        dataDir,
        createConnector: (source) =>
          source.id === "fr-afirev"
            ? failingConnector(source.id, "HTTP 404 while fetching https://example.test/")
            : stubConnector(source.id, '{"records":[]}'),
      });

      expect(outcomes.map((outcome) => [outcome.sourceId, outcome.status])).toEqual([
        ["fr-afirev", "failed"],
        ["dk-fstyr", "changed"],
      ]);
      expect(outcomes[0]).toMatchObject({
        error: "HTTP 404 while fetching https://example.test/",
      });
      // The source that answered is still snapshotted: a neighbour's outage must
      // not cost the run its fresh data.
      const snapshot = await readFile(
        join(dataDir, "raw", "dk-fstyr", "current", "body.json"),
        "utf8",
      );
      expect(snapshot).toContain("records");
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});

function stubConnector(sourceId: string, body: string): RegistryConnector {
  return {
    sourceId,
    fetch: async (context: FetchContext) => ({
      status: "changed" as const,
      sourceId,
      body,
      contentType: "application/json",
      finalUrl: "https://example.test/",
      httpStatus: 200,
      retrievedAt: context.retrievedAt,
      checksum: "checksum",
      etag: null,
      lastModified: null,
    }),
    parse: async () => ({ records: [], warnings: [], errors: [] }),
    normalize: async () => ({ records: [], warnings: [], errors: [] }),
  };
}

function failingConnector(sourceId: string, message: string): RegistryConnector {
  return {
    ...stubConnector(sourceId, ""),
    fetch: async () => {
      throw new Error(message);
    },
  };
}
