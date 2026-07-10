import { describe, expect, it } from "vitest";
import { sourceDefinitionSchema } from "../../src/domain/source-definition.js";
import { loadSourceDefinitions } from "../../src/infrastructure/filesystem/source-loader.js";

const baseSource = {
  id: "es-ripree",
  name: "RIPREE",
  authorityName: "Ministerio para la Transicion Ecologica y el Reto Demografico",
  jurisdictions: ["ES"],
  official: true,
  homepageUrl: "https://energia.serviciosmin.gob.es/RIPREE",
  registryUrl: "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/Export",
  machineReadableUrl: "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/GenerarXml",
  verifiedAt: "2026-07-10",
  connector: "es-ripree",
  enabled: true,
  refreshSchedule: "weekly",
  supportedRoles: ["CPO", "EMSP"],
};

describe("sourceDefinitionSchema", () => {
  it("distinguishes a statutory reuse basis from an explicit licence", () => {
    const source = sourceDefinitionSchema.parse({
      ...baseSource,
      reuse: {
        status: "statutory",
        legalBasis: {
          name: "Spanish Law 37/2007 on reuse of public-sector information",
          url: "https://www.boe.es/eli/es/l/2007/11/16/37/con",
        },
        licence: null,
        attributionNotice: "Cite RIPREE as the source and state the last update date.",
        redistributionAllowed: true,
        notes: null,
      },
    });

    expect(source.reuse.status).toBe("statutory");
    expect(source.reuse.legalBasis?.name).toContain("Law 37/2007");
    expect(source.reuse.licence).toBeNull();
  });

  it("rejects the removed license field", () => {
    expect(() =>
      sourceDefinitionSchema.parse({
        ...baseSource,
        license: { status: "unknown", name: null, url: null },
        reuse: {
          status: "unspecified",
          legalBasis: null,
          licence: null,
          attributionNotice: null,
          redistributionAllowed: null,
          notes: null,
        },
      }),
    ).toThrow();
  });

  it("exposes structured sources consumed by connectors", async () => {
    const sources = await loadSourceDefinitions();
    const machineReadableUrls = Object.fromEntries(
      sources
        .filter((source) => source.machineReadableUrl)
        .map((source) => [source.id, source.machineReadableUrl]),
    );

    expect(machineReadableUrls).toEqual({
      "at-ladestellen": "https://admin.ladestellen.at/api/countries/AT/operators/basic",
      "benelux-idro": "https://www.benelux-idro.eu/en/id-register/export",
      "ch-suisseenergie": "https://www.suisseenergie.ch/page-data/sq/d/3887988665.json",
      "de-bdew": "https://bdew-codes.de/Codenumbers/EMobilityId/GetActiveCodes",
      "es-ripree": "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/GenerarXml",
      "fr-afirev": "https://api.afirev.fr/public/prefixes",
      "gb-evroam": "https://evroam.org.uk/_functions/getRegister",
      "hr-croidro": "https://pametnamobilnost.hr/idro/Home/IspisiCSV",
      "lt-vialietuva": "https://ev.vialietuva.lt/ocpi/2.3.0/locations",
      "lv-lvceli": "https://www.transportdata.gov.lv/api/v1/content/en/idro?_format=json",
      "pl-eipa": "https://eipa.udt.gov.pl/list/csv",
      "se-energimyndigheten":
        "https://www.energimyndigheten.se/4ac461/globalassets/klimat/laddinfrastruktur/register-av-identifieringsdata.xlsx",
      "si-nap": "https://www.ncup.si/dc/prometej.register-cpo-msp",
    });

    const spain = sources.find((source) => source.id === "es-ripree");
    expect(spain?.reuse).toMatchObject({
      status: "statutory",
      legalBasis: {
        name: expect.stringContaining("Law 37/2007"),
        url: "https://www.boe.es/eli/es/l/2007/11/16/37/con",
      },
    });

    const latvia = sources.find((source) => source.id === "lv-lvceli");
    expect(latvia).toMatchObject({
      authorityName: "SLLC Latvijas Valsts ceļi",
      official: true,
      homepageUrl: "https://www.transportdata.gov.lv/en/idro",
      registryUrl: "https://www.transportdata.gov.lv/api/v1/content/en/idro?_format=json",
      machineReadableUrl: "https://www.transportdata.gov.lv/api/v1/content/en/idro?_format=json",
      verifiedAt: "2026-07-10",
    });
  });
});
