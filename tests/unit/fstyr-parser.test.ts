import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { FstyrConnector } from "../../src/connectors/dk-fstyr/fstyr.connector.js";
import { parseFstyrHtml } from "../../src/connectors/dk-fstyr/fstyr.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Danish Road Traffic Authority parser", () => {
  it("parses the captured HTML fixture", async () => {
    const body = await readFile("tests/fixtures/dk-fstyr/idro-registration.html", "utf8");
    const result = parseFstyrHtml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      cvr: "39323273",
      companyName: "Ionity GmbH Danish Branch, filial af IONITY",
      cpoIds: ["DK-IOY"],
      emspIds: ["DK-IOY"],
    });
  });

  it("reports a missing registry table", () => {
    const result = parseFstyrHtml(
      "<html><body><table><tr><td>Other</td></tr></table></body></html>",
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("FSTYR_TABLE_NOT_FOUND");
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("dk-fstyr");
    const connector = new FstyrConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          cvr: "38335294",
          companyName: "Lineo ApS",
          cpoIds: ["DK- 383"],
          emspIds: ["DK- 383"],
        },
      ],
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.key)).toEqual([
      "dk-fstyr:DK:383:CPO",
      "dk-fstyr:DK:383:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["DK383", "DK383"]);
    expect(result.records[0]?.source.sourceUrl).toBe(
      "https://www.danishroadtrafficauthority.dk/afir/idro-registration",
    );
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("dk-fstyr");
    const connector = new FstyrConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          cvr: null,
          companyName: "Bad",
          cpoIds: ["DK-TOO-LONG"],
          emspIds: [],
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("FSTYR_MALFORMED_IDENTIFIER");
  });
});
