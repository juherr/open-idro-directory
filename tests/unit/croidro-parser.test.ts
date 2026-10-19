import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CroIdroConnector } from "../../src/connectors/hr-croidro/croidro.connector.js";
import { parseCroIdroHtml } from "../../src/connectors/hr-croidro/croidro.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

const HEADER_ROW = "<tr><th>Naziv tvrtke / osobe</th><th>CPO ID</th><th>MSP ID</th></tr>";

describe("Croatian IDRO parser", () => {
  it("parses the captured search page", async () => {
    const body = await readFile("tests/fixtures/hr-croidro/pretraga-2026-10.html", "utf8");
    const result = parseCroIdroHtml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(47);
    expect(result.records.flatMap((record) => [...record.cpoIds, ...record.emspIds])).toHaveLength(
      88,
    );
    expect(result.records[0]).toEqual({
      companyName: "Electrip Mobility Service d.o.o.",
      cpoIds: ["HR-ELC"],
      emspIds: ["HR-ELC"],
    });
  });

  // The CSV export replaces every non-ASCII letter with "?"; the page keeps them.
  it("keeps the Croatian letters of organization names", async () => {
    const body = await readFile("tests/fixtures/hr-croidro/pretraga-2026-10.html", "utf8");
    const result = parseCroIdroHtml(body);

    expect(result.records).toContainEqual({
      companyName: "Sunčani auto park Zagreb d.o.o.",
      cpoIds: ["HR-SAP"],
      emspIds: ["HR-001"],
    });
  });

  it("reads an empty identifier cell as no identifier", async () => {
    const body = await readFile("tests/fixtures/hr-croidro/pretraga-2026-10.html", "utf8");
    const result = parseCroIdroHtml(body);

    expect(result.records).toContainEqual({
      companyName: "Intis engineering d.o.o.",
      cpoIds: ["HR-INT"],
      emspIds: [],
    });
    expect(result.records).toContainEqual({
      companyName: "Open Way d.o.o.",
      cpoIds: [],
      emspIds: ["HR-120"],
    });
  });

  it("reports a page without the registry table", () => {
    const result = parseCroIdroHtml("<html><body><p>Održavanje</p></body></html>");

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("CROIDRO_TABLE_NOT_FOUND");
  });

  it("reports unexpected headers", () => {
    const result = parseCroIdroHtml(
      "<table><tr><th>Company</th><th>CPO ID</th><th>MSP ID</th></tr>" +
        "<tr><td>Bad</td><td>HR-BAD</td><td></td></tr></table>",
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("CROIDRO_UNEXPECTED_HEADERS");
  });

  // Without the session cookie of this page, the CSV export answered with its
  // header row alone, and the source published nothing without failing.
  it("reports a table without rows instead of an empty registry", () => {
    const result = parseCroIdroHtml(`<table>${HEADER_ROW}</table>`);

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("CROIDRO_EMPTY_TABLE");
  });

  it("reports a row with the wrong number of cells", () => {
    const result = parseCroIdroHtml(
      `<table>${HEADER_ROW}<tr><td>Bad</td><td>HR-BAD</td></tr>` +
        "<tr><td>Good</td><td>HR-GOD</td><td></td></tr></table>",
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("CROIDRO_MALFORMED_ROW");
    expect(result.records).toEqual([{ companyName: "Good", cpoIds: ["HR-GOD"], emspIds: [] }]);
  });

  it("does not truncate malformed identifiers while parsing", () => {
    const result = parseCroIdroHtml(
      `<table>${HEADER_ROW}<tr><td>Bad</td><td><span>HR-TOO-LONG</span></td><td></td></tr></table>`,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.records[0]?.cpoIds).toEqual(["HR-TOO-LONG"]);
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("hr-croidro");
    const connector = new CroIdroConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Sunčani auto park Zagreb d.o.o.",
          cpoIds: ["HR-SAP"],
          emspIds: ["HR-001"],
        },
      ],
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.key)).toEqual([
      "hr-croidro:HR:SAP:CPO",
      "hr-croidro:HR:001:EMSP",
    ]);
    expect(result.records.map((record) => record.eMobilityId)).toEqual(["HRSAP", "HR001"]);
    expect(result.records[0]?.source.sourceUrl).toBe("https://pametnamobilnost.hr/idro/Pretraga");
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("hr-croidro");
    const connector = new CroIdroConnector();
    const result = await connector.normalize({
      source,
      retrievedAt: "2026-06-15T00:00:00.000Z",
      records: [
        {
          companyName: "Bad",
          cpoIds: ["HR-TOO-LONG"],
          emspIds: [],
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("CROIDRO_MALFORMED_IDENTIFIER");
  });
});
