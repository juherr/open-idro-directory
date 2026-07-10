import { describe, expect, it } from "vitest";
import { sourceDefinitionSchema } from "../../src/domain/source-definition.js";

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
});
