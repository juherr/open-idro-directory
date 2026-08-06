import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildRegistry, type BuildOptions } from "../../src/application/build-registry.js";
import type { RegistryConnector } from "../../src/connectors/connector.js";
import type { NormalizedRegistryRecord } from "../../src/domain/registry-record.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("buildRegistry", () => {
  it("keeps the records of the sources a filtered run did not rebuild", async () => {
    await withWorkspace(async ({ build, outputDir }) => {
      const result = await build({ sourceId: "fr-afirev" });

      expect(result.records.map((record) => record.key).toSorted()).toEqual([
        "dk-fstyr:DK:BBB:CPO",
        "fr-afirev:FR:AAA:CPO",
      ]);
      const published = JSON.parse(
        await readFile(join(outputDir, "registry.json"), "utf8"),
      ) as NormalizedRegistryRecord[];
      expect(published.filter((record) => record.source.registryId === "dk-fstyr")).toHaveLength(1);
    });
  });

  it("keeps the health of the sources a filtered run did not rebuild", async () => {
    await withWorkspace(async ({ build, outputDir }) => {
      await build({ sourceId: "fr-afirev" });

      expect(await readHealth(outputDir, "dk-fstyr")).toMatchObject({
        recordCount: 1,
        lastSuccessfulRetrieval: PREVIOUS_RETRIEVAL,
        checksum: "previous-checksum",
        freshness: "current",
      });
    });
  });

  it("drops the records of a source that is no longer published", async () => {
    await withWorkspace(async ({ build, outputDir, sources }) => {
      // Disabling a source is how an operator removes it from the datasets, so
      // carrying unrebuilt sources must not resurrect it.
      const result = await build({
        sourceId: "fr-afirev",
        sources: sources.map((source) =>
          source.id === "dk-fstyr"
            ? { ...source, publication: { ...source.publication, enabled: false } }
            : source,
        ),
      });

      expect(result.records.map((record) => record.key)).toEqual(["fr-afirev:FR:AAA:CPO"]);
      expect(await readHealth(outputDir, "dk-fstyr")).toMatchObject({
        recordCount: 0,
        freshness: "disabled",
      });
    });
  });

  it("refuses a filter that matches no enabled source", async () => {
    await withWorkspace(async ({ build }) => {
      // Otherwise the run rebuilds nothing, republishes everything, and reports
      // success, which reads as "the source was updated".
      await expect(build({ sourceId: "ch-typo" })).rejects.toThrow(
        /no enabled source matches ch-typo/i,
      );
    });
  });

  it("republishes a source that could not be fetched and reports it as stale", async () => {
    await withWorkspace(async ({ build, outputDir }) => {
      const result = await build({
        fetchErrors: { "dk-fstyr": "HTTP 404 while fetching https://example.test/" },
      });

      const failed = result.results.find((entry) => entry.sourceId === "dk-fstyr");
      expect(failed?.errors[0]?.code).toBe("SOURCE_FETCH_FAILED");
      expect(failed?.records.map((record) => record.key)).toEqual(["dk-fstyr:DK:BBB:CPO"]);
      expect(await readHealth(outputDir, "dk-fstyr")).toMatchObject({
        stale: true,
        freshness: "stale",
        latestErrorSummary: "HTTP 404 while fetching https://example.test/",
        // The operator needs to know when the source last answered, so a failed
        // run must not erase the previous success.
        lastSuccessfulRetrieval: PREVIOUS_RETRIEVAL,
      });
    });
  });

  it("throws when every selected source failed", async () => {
    await withWorkspace(async ({ build }) => {
      await expect(
        build({
          fetchErrors: {
            "fr-afirev": "HTTP 500 while fetching https://example.test/",
            "dk-fstyr": "HTTP 404 while fetching https://example.test/",
          },
        }),
      ).rejects.toThrow(/every selected source failed/i);
    });
  });
});

const GENERATED_AT = "2026-06-15T00:00:00.000Z";
const PREVIOUS_RETRIEVAL = "2026-06-14T00:00:00.000Z";

/**
 * Runs the assertions against a throwaway data directory holding two published
 * sources, and hands them a `build` that only needs what the case varies.
 */
async function withWorkspace(
  assertions: (workspace: {
    sources: SourceDefinition[];
    outputDir: string;
    build: (
      overrides?: BuildOptions & { sources?: SourceDefinition[] },
    ) => ReturnType<typeof buildRegistry>;
  }) => Promise<void>,
) {
  const dataDir = await mkdtemp(join(tmpdir(), "open-idro-build-data-"));
  const outputDir = await mkdtemp(join(tmpdir(), "open-idro-build-out-"));
  try {
    const sources = [
      await loadSourceDefinition("fr-afirev"),
      await loadSourceDefinition("dk-fstyr"),
    ];
    await writeWorkspace(dataDir, sources);
    const build = ({
      sources: override,
      ...options
    }: BuildOptions & { sources?: SourceDefinition[] } = {}) =>
      buildRegistry(override ?? sources, {
        dataDir,
        outputDir,
        generatedAt: GENERATED_AT,
        createConnector: connectorReturning([sampleRecord("fr-afirev", "FR", "AAA")]),
        ...options,
      });
    await assertions({ sources, outputDir, build });
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
}

async function writeWorkspace(dataDir: string, sources: SourceDefinition[]) {
  await writeFile(
    join(dataDir, "registry.json"),
    JSON.stringify([sampleRecord("fr-afirev", "FR", "AAA"), sampleRecord("dk-fstyr", "DK", "BBB")]),
  );
  await writeFile(
    join(dataDir, "sources.json"),
    JSON.stringify(
      sources.map((source) => ({
        id: source.id,
        health: {
          stale: false,
          recordCount: 1,
          lastAttemptedRetrieval: PREVIOUS_RETRIEVAL,
          lastSuccessfulRetrieval: PREVIOUS_RETRIEVAL,
          checksum: "previous-checksum",
          freshness: "current",
          latestErrorSummary: null,
        },
      })),
    ),
  );
  for (const source of sources) {
    const dir = join(dataDir, "raw", source.id, "current");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "body.json"), "{}");
    await writeFile(
      join(dir, "metadata.json"),
      JSON.stringify({
        sourceId: source.id,
        contentType: "application/json",
        finalUrl: "https://example.test/",
        httpStatus: 200,
        retrievedAt: GENERATED_AT,
        etag: null,
        lastModified: null,
        checksum: "snapshot-checksum",
      }),
    );
  }
}

async function readHealth(outputDir: string, sourceId: string) {
  const summaries = JSON.parse(await readFile(join(outputDir, "sources.json"), "utf8")) as {
    id: string;
    health: Record<string, unknown>;
  }[];
  return summaries.find((summary) => summary.id === sourceId)?.health;
}

function connectorReturning(records: NormalizedRegistryRecord[]): () => RegistryConnector {
  return () => ({
    sourceId: "stub",
    fetch: async () => {
      throw new Error("not used by the build");
    },
    parse: async () => ({ records: [], warnings: [], errors: [] }),
    normalize: async () => ({ records, warnings: [], errors: [] }),
  });
}

function sampleRecord(
  registryId: string,
  countryCode: string,
  partyId: string,
): NormalizedRegistryRecord {
  return {
    key: `${registryId}:${countryCode}:${partyId}:CPO`,
    countryCode,
    partyId,
    eMobilityId: `${countryCode}${partyId}`,
    role: "CPO",
    status: "ACTIVE",
    organization: { name: "Example", legalName: null, website: null },
    source: {
      registryId,
      official: true,
      sourceRecordId: `${countryCode}${partyId}`,
      sourceUrl: "https://example.test/",
      sourceValue: `${countryCode}${partyId}`,
      firstSeenAt: PREVIOUS_RETRIEVAL,
      lastSeenAt: PREVIOUS_RETRIEVAL,
      retrievedAt: PREVIOUS_RETRIEVAL,
    },
    metadata: {},
  };
}
