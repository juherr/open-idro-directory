import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { AfirevConnector } from "../../src/connectors/fr-afirev/afirev.connector.js";
import { parseAfirevJson } from "../../src/connectors/fr-afirev/afirev.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("AFIREV parser", () => {
  it("parses the captured public fixture", async () => {
    const body = await readFile("tests/fixtures/fr-afirev/public-prefixes.json", "utf8");
    const result = parseAfirevJson(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records.length).toBeGreaterThan(300);
    expect(result.records[0]).toHaveProperty("prefixId");
  });

  it("reports malformed rows", () => {
    const result = parseAfirevJson(JSON.stringify({ data: [{ prefixId: 1 }] }));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("AFIREV_MALFORMED_ROW");
  });

  it("normalizes known and unknown role/status values", async () => {
    const source = await loadSourceDefinition("fr-afirev");
    const connector = new AfirevConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      records: [
        {
          prefixId: "FRABC",
          name: "Operator",
          type: "BOTH",
          status: "ACTIVE",
          amenageurName: "",
          exploitantName: "",
        },
        {
          prefixId: "FRXYZ",
          name: "Unknown",
          type: "SURPRISE",
          status: "ODD",
          amenageurName: "",
          exploitantName: "",
        },
      ],
    });

    expect(result.records.map((record) => record.role)).toEqual(["CPO", "EMSP", "OTHER"]);
    expect(result.records.map((record) => record.status)).toEqual(["ACTIVE", "ACTIVE", "UNKNOWN"]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "AFIREV_UNKNOWN_ROLE",
      "AFIREV_UNKNOWN_STATUS",
    ]);
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("fr-afirev");
    const connector = new AfirevConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-14T00:00:00.000Z",
      records: [
        {
          prefixId: "FR-ABC",
          name: "Bad",
          type: "CHARGE",
          status: "ACTIVE",
          amenageurName: "",
          exploitantName: "",
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("AFIREV_MALFORMED_IDENTIFIER");
  });
});
