import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { LvceliConnector } from "../../src/connectors/lv-lvceli/lvceli.connector.js";
import { parseLvceliJson } from "../../src/connectors/lv-lvceli/lvceli.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("LVCELI parser", () => {
  it("parses the captured Drupal JSON fixture", async () => {
    const body = await readFile("tests/fixtures/lv-lvceli/idro.json", "utf8");
    const result = parseLvceliJson(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      legalEntityName: "LLC “Smart Electric Technology”",
      cpoIds: ["LV-SET"],
      emspIds: ["LV-SET"],
      website: "https://www.s-e-t.lv",
    });
    expect(result.records[1]?.cpoIds).toEqual(["LV-IGN"]);
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("lv-lvceli");
    const connector = new LvceliConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          legalEntityName: "LLC Smart Electric Technology",
          cpoIds: ["LV-SET"],
          emspIds: ["LV-SET"],
          email: "info@s-e-t.lv",
          website: "https://www.s-e-t.lv",
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "lv-lvceli:LV:SET:CPO",
      "lv-lvceli:LV:SET:EMSP",
    ]);
  });
});
