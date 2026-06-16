import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RipreeConnector } from "../../src/connectors/es-ripree/ripree.connector.js";
import { parseRipreeXml } from "../../src/connectors/es-ripree/ripree.parser.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

describe("Spanish RIPREE parser", () => {
  it("parses the captured XML fixture", async () => {
    const body = await readFile("tests/fixtures/es-ripree/empresas.xml", "utf8");
    const result = parseRipreeXml(body);

    expect(result.errors).toHaveLength(0);
    expect(result.records).toHaveLength(5);
    expect(result.records[0]).toMatchObject({
      document: "A85908036",
      sourceValue: "ES*FEN",
      companyType: "CPO",
      organizationName: "FENIE ENERGIA, SA",
      website: "recarga.fenieenergia.es",
    });
    expect(result.records[3]?.organizationName).toBe("Porsche Sales & Marketplace GmbH");
  });

  it("reports a missing XML root", () => {
    const result = parseRipreeXml("<html><body>Not the export</body></html>");

    expect(result.records).toHaveLength(0);
    expect(result.errors[0]?.code).toBe("RIPREE_ROOT_NOT_FOUND");
  });

  it("normalizes CPO and EMSP identifiers", async () => {
    const source = await loadSourceDefinition("es-ripree");
    const body = await readFile("tests/fixtures/es-ripree/empresas.xml", "utf8");
    const parsed = parseRipreeXml(body);
    const result = await new RipreeConnector().normalize({
      source,
      retrievedAt: "2026-06-16T00:00:00.000Z",
      records: parsed.records,
    });

    expect(result.warnings).toEqual([]);
    expect(result.records.map((record) => `${record.eMobilityId}:${record.role}`)).toEqual([
      "ESFEN:CPO",
      "ESEFI:EMSP",
      "ESEFI:CPO",
      "ES911:EMSP",
      "ESHSS:CPO",
    ]);
    expect(result.records[0]?.organization.website).toBe("https://recarga.fenieenergia.es/");
    expect(result.records[4]?.organization.website).toBe("https://auditenergia.com/");
    expect(result.records[4]?.metadata.ripreeWebsite).toBe("tramits@auditenergia.com");
    expect(result.records[0]?.source.sourceUrl).toBe(
      "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/Export",
    );
    expect(result.records[1]?.metadata).toMatchObject({
      ripreeDocument: "B27805423",
      ripreeProvince: "Pontevedra",
      ripreeMunicipality: "Nigrán",
      ripreeSeparator: "*",
    });
  });

  it("warns and skips malformed identifiers", async () => {
    const source = await loadSourceDefinition("es-ripree");
    const result = await new RipreeConnector().normalize({
      source,
      retrievedAt: "2026-06-16T00:00:00.000Z",
      records: [
        {
          document: "X",
          sourceValue: "ES-TOO-LONG",
          companyType: "CPO",
          organizationName: "Bad",
          address: null,
          country: null,
          autonomousCommunity: null,
          province: null,
          municipality: null,
          postalCode: null,
          website: null,
        },
      ],
    });

    expect(result.records).toHaveLength(0);
    expect(result.warnings[0]?.code).toBe("RIPREE_MALFORMED_IDENTIFIER");
  });
});
