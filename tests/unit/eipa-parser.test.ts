import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { EipaConnector } from "../../src/connectors/pl-eipa/eipa.connector.js";
import { parseEipaCsv } from "../../src/connectors/pl-eipa/eipa.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("EIPA parser", () => {
  it("parses the captured CSV fixture", async () => {
    const body = await readFile("tests/fixtures/pl-eipa/list.csv", "utf8");
    const result = parseEipaCsv(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(3);
    expect(result.records[1]).toMatchObject({
      organizationName: "Flowbird Polska Sp. z o.o.",
      cpoId: "FR-FLB",
      emspId: "FR-FLB",
      city: "Łódź",
    });
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("pl-eipa");
    const connector = new EipaConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          organizationName: "Flowbird Polska Sp. z o.o.",
          cpoId: "PL-7R5",
          emspId: "PL-7R5",
          city: "Łódź",
          country: "Polska",
          website: null,
          registeredAt: "2023-06-12T09:20:36+02:00",
        },
      ],
    });

    expect(result.records.map((record) => record.key)).toEqual([
      "pl-eipa:PL:7R5:CPO",
      "pl-eipa:PL:7R5:EMSP",
    ]);
  });
});
