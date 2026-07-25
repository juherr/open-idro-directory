import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../../src/application/build-registry.js";
import { refreshSourceMetadata } from "../../src/application/refresh-source-metadata.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

describe("deterministic generation", () => {
  it("generates byte-identical registry data from the same raw fixture", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-serialization-"));
    const sources = (await loadSourceDefinitions()).map((source) =>
      source.id === "fr-afirev"
        ? {
            ...source,
            safety: {
              ...source.safety,
              maxDeletionRatio: 1,
              maxChangeRatio: 1,
            },
          }
        : source,
    );
    try {
      await buildRegistry(sources, {
        sourceId: "fr-afirev",
        generatedAt: "2026-06-14T00:00:00.000Z",
        outputDir,
      });
      const first = await readFile(join(outputDir, "registry.json"), "utf8");
      await buildRegistry(sources, {
        sourceId: "fr-afirev",
        generatedAt: "2026-06-14T00:00:00.000Z",
        outputDir,
      });
      const second = await readFile(join(outputDir, "registry.json"), "utf8");

      expect(second).toBe(first);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("refreshes source metadata without rewriting registry records or health timestamps", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-source-metadata-"));
    const [source] = await loadSourceDefinitions();
    if (!source) throw new Error("Expected at least one source definition.");
    const registry = '[{"key":"unchanged"}]\n';
    const health = {
      stale: false,
      recordCount: 12,
      lastAttemptedRetrieval: "2026-07-01T00:00:00.000Z",
      lastSuccessfulRetrieval: "2026-07-01T00:00:00.000Z",
      checksum: "checksum",
      freshness: "current",
      latestErrorSummary: null,
    };
    try {
      await writeFile(join(outputDir, "registry.json"), registry);
      await writeFile(
        join(outputDir, "sources.json"),
        `${JSON.stringify([{ id: source.id, health }], null, 2)}\n`,
      );

      const summaries = await refreshSourceMetadata([source], outputDir);

      expect(summaries[0]?.health).toEqual(health);
      await expect(readFile(join(outputDir, "registry.json"), "utf8")).resolves.toBe(registry);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("serializes structured Finnish reuse metadata", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-finnish-metadata-"));
    const source = (await loadSourceDefinitions()).find(
      (candidate) => candidate.id === "fi-traficom",
    );
    if (!source) throw new Error("Expected the Finnish source definition.");
    const health = {
      stale: false,
      recordCount: 25,
      lastAttemptedRetrieval: "2026-07-24T00:00:00.000Z",
      lastSuccessfulRetrieval: "2026-07-24T00:00:00.000Z",
      checksum: "finnish-checksum",
      freshness: "current",
      latestErrorSummary: null,
    };
    try {
      await writeFile(
        join(outputDir, "sources.json"),
        `${JSON.stringify([{ id: source.id, health }], null, 2)}\n`,
      );

      const [summary] = await refreshSourceMetadata([source], outputDir);

      expect(summary).toMatchObject({
        id: "fi-traficom",
        verifiedAt: "2026-07-25",
        reuse: {
          status: "licensed",
          licence: {
            name: "CC BY 4.0",
            url: "https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data",
          },
          attributionNotice: expect.stringContaining("Traficom"),
          redistributionAllowed: true,
        },
        health,
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("serializes structured Irish reuse metadata", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-irish-metadata-"));
    const source = (await loadSourceDefinitions()).find((candidate) => candidate.id === "ie-tii");
    if (!source) throw new Error("Expected the Irish source definition.");
    const health = {
      stale: false,
      recordCount: 26,
      lastAttemptedRetrieval: "2026-07-24T00:00:00.000Z",
      lastSuccessfulRetrieval: "2026-07-24T00:00:00.000Z",
      checksum: "irish-checksum",
      freshness: "current",
      latestErrorSummary: null,
    };
    try {
      await writeFile(
        join(outputDir, "sources.json"),
        `${JSON.stringify([{ id: source.id, health }], null, 2)}\n`,
      );

      const [summary] = await refreshSourceMetadata([source], outputDir);

      expect(summary).toMatchObject({
        id: "ie-tii",
        verifiedAt: "2026-07-25",
        reuse: {
          status: "licensed",
          licence: {
            name: "CC BY 4.0",
            url: "https://www.tii.ie/en/compliance/reuse-of-public-sector-information/",
          },
          attributionNotice:
            "Contains Irish Public Sector Information licensed under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence",
          redistributionAllowed: true,
        },
        health,
      });
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
