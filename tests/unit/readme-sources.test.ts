import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  extractSupportedSourcesTable,
  renderSupportedSourcesTable,
  replaceSupportedSourcesTable,
} from "../../src/documentation/readme-sources.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

describe("README supported sources", () => {
  it("renders reuse terms from source descriptors", async () => {
    const table = renderSupportedSourcesTable(await loadSourceDefinitions());

    expect(table).toContain(
      "Statutory - [Spanish Law 37/2007 on reuse of public-sector information](https://www.boe.es/eli/es/l/2007/11/16/37/con)",
    );
    expect(table).toContain("No explicit reuse terms identified (reviewed 2026-07-10)");
    expect(table).toContain(
      "| Danish Road Traffic Authority (`dk-fstyr`) | Supported: 🇩🇰 | Public HTML table from the IDRO registration page | Undetermined |",
    );
    expect(table).toContain(
      "[CC BY 4.0](https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data)",
    );
  });

  it("keeps every descriptor represented exactly once", async () => {
    const sources = await loadSourceDefinitions();
    const table = renderSupportedSourcesTable(sources);

    for (const source of sources) {
      expect(table.match(new RegExp(`\\(\\\`${source.id}\\\`\\)`, "g"))).toHaveLength(1);
    }
  });

  it("replaces only the generated table between stable markers", async () => {
    const sources = await loadSourceDefinitions();
    const readme = [
      "# Before",
      "<!-- BEGIN GENERATED SUPPORTED SOURCES -->",
      "stale",
      "<!-- END GENERATED SUPPORTED SOURCES -->",
      "# After",
      "",
    ].join("\n");

    const updated = replaceSupportedSourcesTable(readme, sources);

    expect(updated.startsWith("# Before\n<!-- BEGIN GENERATED SUPPORTED SOURCES -->\n")).toBe(true);
    expect(updated.endsWith("<!-- END GENERATED SUPPORTED SOURCES -->\n# After\n")).toBe(true);
    expect(extractSupportedSourcesTable(updated)).toBe(renderSupportedSourcesTable(sources));
  });

  it("rejects README content without exactly one generated section", async () => {
    const sources = await loadSourceDefinitions();

    expect(() => replaceSupportedSourcesTable("# Missing markers\n", sources)).toThrow(
      "README must contain exactly one generated supported-sources section.",
    );
  });

  it("matches the generated section committed in README.md", async () => {
    const [readme, sources] = await Promise.all([
      readFile("README.md", "utf8"),
      loadSourceDefinitions(),
    ]);

    expect(extractSupportedSourcesTable(readme)).toBe(renderSupportedSourcesTable(sources));
  });
});
