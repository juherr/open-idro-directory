import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { VialietuvaConnector } from "../../src/connectors/lt-vialietuva/vialietuva.connector.js";
import { parseVialietuvaLocations } from "../../src/connectors/lt-vialietuva/vialietuva.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Via Lietuva parser", () => {
  it("parses the captured OCPI fixture", async () => {
    const body = await readFile("tests/fixtures/lt-vialietuva/locations.json", "utf8");
    const result = parseVialietuvaLocations(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      country_code: "LT",
      party_id: "IBG",
      operator: { name: "In Balance grid, UAB" },
    });
  });

  it("deduplicates locations by Lithuanian CPO identifier", async () => {
    const source = await loadSourceDefinition("lt-vialietuva");
    const connector = new VialietuvaConnector();
    const body = await readFile("tests/fixtures/lt-vialietuva/locations.json", "utf8");
    const parsed = parseVialietuvaLocations(body);
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: parsed.records,
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "lt-vialietuva:LT:IBG:CPO",
      "lt-vialietuva:LT:ION:CPO",
    ]);
    expect(result.records[0]?.metadata.vialietuvaLocationCount).toBe(2);
  });
});
