import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../../src/application/build-registry.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

describe("deterministic generation", () => {
  it("generates byte-identical registry data from the same raw fixture", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "open-idro-serialization-"));
    const sources = await loadSourceDefinitions();
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
});
