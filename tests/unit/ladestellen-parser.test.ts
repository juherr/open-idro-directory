import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { LadestellenConnector } from "../../src/connectors/at-ladestellen/ladestellen.connector.js";
import { parseLadestellenJson } from "../../src/connectors/at-ladestellen/ladestellen.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Ladestellen.at parser", () => {
  it("parses the captured operators fixture", async () => {
    const body = await readFile("tests/fixtures/at-ladestellen/operators-basic.json", "utf8");
    const result = parseLadestellenJson(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toHaveProperty("operatorId", "SMA");
  });

  it("reports malformed rows", () => {
    const result = parseLadestellenJson(JSON.stringify([{ operatorId: 1 }]));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("LADESTELLEN_MALFORMED_ROW");
  });

  it("normalizes operators as Austrian CPO identifiers", async () => {
    const source = await loadSourceDefinition("at-ladestellen");
    const connector = new LadestellenConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      records: [
        {
          operatorId: "sma",
          type: "ORGANIZATION",
          organization: "SMATRICS GmbH und Co KG",
          firstName: null,
          lastName: null,
        },
        {
          operatorId: "009",
          type: "PERSON",
          organization: null,
          firstName: "Manfred",
          lastName: "Unger",
        },
      ],
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.key)).toEqual([
      "at-ladestellen:AT:SMA:CPO",
      "at-ladestellen:AT:009:CPO",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["ATSMA", "AT009"]);
    expect(result.records[1]?.organization.name).toBe("Manfred Unger");
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("at-ladestellen");
    const connector = new LadestellenConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      records: [
        {
          operatorId: "TOO-LONG",
          type: "ORGANIZATION",
          organization: "Bad",
          firstName: null,
          lastName: null,
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("LADESTELLEN_MALFORMED_IDENTIFIER");
  });
});
