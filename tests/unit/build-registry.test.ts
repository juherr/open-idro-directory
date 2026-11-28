import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildRegistry, type BuildOptions } from "../../src/application/build-registry.js";
import { EvroamConnector } from "../../src/connectors/gb-evroam/evroam.connector.js";
import type { RegistryConnector } from "../../src/connectors/connector.js";
import { EnergimyndighetenConnector } from "../../src/connectors/se-energimyndigheten/energimyndigheten.connector.js";
import type {
  NormalizedRegistryRecord,
  RegistryObservation,
} from "../../src/domain/registry-record.js";
import type { SourceDefinition } from "../../src/domain/source-definition.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";
import { validateRegistry } from "../../src/validation/registry-validator.js";

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

  // #91 reference scenario 6: the issuing register being unreachable says
  // nothing about the identifiers another register lists.
  it("keeps a cross-register listing when the issuing source failed", async () => {
    const evroam = await loadSourceDefinition("gb-evroam");
    const listing = await new EvroamConnector().normalize({
      source: evroam,
      retrievedAt: GENERATED_AT,
      records: [{ title: "Blink Charge UK Ltd", operatorIdIE: "IE*BLK" }],
    });
    const official = sampleRecord("ie-tii", "IE", "BLK");
    await withWorkspace(
      async ({ build, outputDir }) => {
        const result = await build({
          createConnector: connectorReturning(listing.records),
          fetchErrors: { "ie-tii": "HTTP 503 while fetching https://example.test/" },
        });

        expect(result.records.map((record) => record.key).toSorted()).toEqual([
          "gb-evroam:IE:BLK:CPO",
          "ie-tii:IE:BLK:CPO",
        ]);
        const observed = result.records.find((record) => record.key === "gb-evroam:IE:BLK:CPO");
        expect(observed?.source).toMatchObject({
          official: false,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "GB" },
        });
        expect(await readHealth(outputDir, "ie-tii")).toMatchObject({ freshness: "stale" });
      },
      { sourceIds: ["ie-tii", "gb-evroam"], published: [official] },
    );
  });

  // Issue #91, scenarios 4 and 5: absence from the issuing register is not
  // invalidity, and the issuing register is left as it is.
  it("publishes a PL identifier another register lists while the Polish register does not", async () => {
    const sweden = await loadSourceDefinition("se-energimyndigheten");
    const swedishRecords = await new EnergimyndighetenConnector().normalize({
      source: sweden,
      retrievedAt: GENERATED_AT,
      records: [
        {
          sourceValue: "PL*ABC",
          organizationName: "Example Polska",
          role: "CPO",
          sourceUrl: "https://example.test/",
        },
      ],
    });
    const polish = withObservationBlock(sampleRecord("pl-eipa", "PL", "XYZ"), {
      kind: "ASSIGNMENT",
      observingJurisdiction: "PL",
    });
    const connectors: Record<string, NormalizedRegistryRecord[]> = {
      "pl-eipa": [polish],
      "se-energimyndigheten": swedishRecords.records,
    };
    await withWorkspace(
      async ({ build, outputDir, sources }) => {
        const result = await build({
          createConnector: (source) => connectorReturning(connectors[source.id] ?? [])(),
        });

        const listing = result.records.find(
          (record) => record.key === "se-energimyndigheten:PL:ABC:CPO",
        );
        expect(listing?.source).toMatchObject({
          official: false,
          observation: { kind: "CROSS_REGISTER_LISTING", observingJurisdiction: "SE" },
        });
        expect(
          result.records
            .filter((record) => record.source.registryId === "pl-eipa")
            .map((record) => record.key),
        ).toEqual(["pl-eipa:PL:XYZ:CPO"]);
        // Only the retrieval time of this run differs from what pl-eipa published.
        expect(result.records.find((record) => record.key === polish.key)).toEqual({
          ...polish,
          source: { ...polish.source, retrievedAt: GENERATED_AT },
        });
        expect(validateRegistry(result.records, sources)).toEqual([]);
        const invalid = JSON.parse(
          await readFile(join(outputDir, "registry-invalid.json"), "utf8"),
        ) as { records: unknown[]; rows: unknown[]; outOfJurisdiction: unknown[] };
        expect(invalid).toMatchObject({ records: [], rows: [], outOfJurisdiction: [] });
      },
      { sourceIds: ["pl-eipa", "se-energimyndigheten"], published: [polish] },
    );
  });

  // Records published before the observation block existed carry none: the
  // first rebuild that adds it must not read as every record having changed.
  it("does not count the observation block a published record lacks as a change", async () => {
    const current = withObservationBlock(sampleRecord("fr-afirev", "FR", "AAA"), {
      kind: "ASSIGNMENT",
      observingJurisdiction: "FR",
    });
    await withWorkspace(async ({ build }) => {
      const result = await build({
        sourceId: "fr-afirev",
        createConnector: connectorReturning([current]),
      });

      const afirev = result.results.find((entry) => entry.sourceId === "fr-afirev");
      expect(afirev?.errors).toEqual([]);
      expect(result.records.find((record) => record.key === current.key)?.source).toMatchObject({
        observation: { kind: "ASSIGNMENT", observingJurisdiction: "FR" },
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
  setup: { sourceIds?: string[]; published?: NormalizedRegistryRecord[] } = {},
) {
  const dataDir = await mkdtemp(join(tmpdir(), "open-idro-build-data-"));
  const outputDir = await mkdtemp(join(tmpdir(), "open-idro-build-out-"));
  try {
    const sources = await Promise.all(
      (setup.sourceIds ?? ["fr-afirev", "dk-fstyr"]).map((id) => loadSourceDefinition(id)),
    );
    await writeWorkspace(
      dataDir,
      sources,
      setup.published ?? [
        sampleRecord("fr-afirev", "FR", "AAA"),
        sampleRecord("dk-fstyr", "DK", "BBB"),
      ],
    );
    const build = ({
      sources: override,
      ...options
    }: BuildOptions & { sources?: SourceDefinition[] } = {}) =>
      buildRegistry(override ?? sources, {
        dataDir,
        outputDir,
        generatedAt: GENERATED_AT,
        // Connectors set the observation block; the published records predate it.
        createConnector: connectorReturning([
          withObservationBlock(sampleRecord("fr-afirev", "FR", "AAA"), {
            kind: "ASSIGNMENT",
            observingJurisdiction: "FR",
          }),
        ]),
        ...options,
      });
    await assertions({ sources, outputDir, build });
  } finally {
    await rm(dataDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
}

async function writeWorkspace(
  dataDir: string,
  sources: SourceDefinition[],
  published: NormalizedRegistryRecord[],
) {
  await writeFile(join(dataDir, "registry.json"), JSON.stringify(published));
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

function withObservationBlock(
  record: NormalizedRegistryRecord,
  observation: RegistryObservation,
): NormalizedRegistryRecord {
  return { ...record, source: { ...record.source, observation } };
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
