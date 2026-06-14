import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../../src/application/build-registry.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

describe("deterministic generation", () => {
  it("generates byte-identical registry data from the same raw fixture", async () => {
    const generatedFiles = [
      "data/registry.json",
      "data/registry.min.json",
      "data/registry.ndjson",
      "data/registry.csv",
      "data/sources.json",
      "data/stats.json",
    ];
    const originalFiles = await Promise.all(
      generatedFiles.map(async (path) => [path, await readFile(path, "utf8")] as const),
    );
    const sources = await loadSourceDefinitions();
    try {
      await buildRegistry(sources, {
        sourceId: "fr-afirev",
        generatedAt: "2026-06-14T00:00:00.000Z",
      });
      const first = await readFile("data/registry.json", "utf8");
      await buildRegistry(sources, {
        sourceId: "fr-afirev",
        generatedAt: "2026-06-14T00:00:00.000Z",
      });
      const second = await readFile("data/registry.json", "utf8");

      expect(second).toBe(first);
    } finally {
      await Promise.all(originalFiles.map(([path, content]) => writeFile(path, content)));
    }
  });
});
