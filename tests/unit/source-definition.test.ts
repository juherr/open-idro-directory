import { describe, expect, it } from "vitest";
import { authorityDefinitionSchema } from "../../src/domain/authority-definition.js";
import {
  isAuthoritative,
  resolveSourceDefinitions,
  sourceDescriptorSchema,
  sourceJurisdictions,
} from "../../src/domain/source-definition.js";
import { liftLegacyDescriptor } from "../../src/infrastructure/filesystem/legacy-source-descriptor.js";
import {
  loadAuthorityDefinitions,
  loadSourceDefinitions,
} from "../../src/infrastructure/filesystem/source-loader.js";

/** Descriptors written against the pre-#46 flat shape are lifted on the way in. */
function parseLegacy(document: unknown) {
  return sourceDescriptorSchema.parse(liftLegacyDescriptor(document));
}

const ripreeAuthority = {
  id: "es-miteco",
  name: "Ministerio para la Transicion Ecologica y el Reto Demografico",
  level: "AUTHORITATIVE",
  jurisdictions: ["ES"],
  homepageUrl: "https://energia.serviciosmin.gob.es/RIPREE",
};

const baseDescriptor = {
  id: "es-ripree",
  name: "RIPREE",
  authorityId: "es-miteco",
  registry: {
    url: "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/Export",
    observationType: "OFFICIAL_ASSIGNMENT",
    supportedRoles: ["CPO", "EMSP"],
  },
  publication: {
    connector: "es-ripree",
    machineReadableUrl: "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/GenerarXml",
    refreshSchedule: "weekly",
    enabled: true,
    verifiedAt: "2026-07-10",
  },
};

const statutoryReuse = {
  status: "statutory",
  legalBasis: {
    name: "Spanish Law 37/2007 on reuse of public-sector information",
    url: "https://www.boe.es/eli/es/l/2007/11/16/37/con",
  },
  licence: null,
  attributionNotice: "Cite RIPREE as the source and state the last update date.",
  redistributionAllowed: true,
  notes: null,
};

const unspecifiedReuse = {
  status: "unspecified",
  legalBasis: null,
  licence: null,
  attributionNotice: null,
  redistributionAllowed: null,
  notes: null,
};

describe("authorityDefinitionSchema", () => {
  it("carries the authority level instead of a boolean", () => {
    const authority = authorityDefinitionSchema.parse(ripreeAuthority);
    expect(authority.level).toBe("AUTHORITATIVE");
  });

  it("accepts a non-authoritative level that no boolean could express", () => {
    const authority = authorityDefinitionSchema.parse({
      ...ripreeAuthority,
      id: "eu-eafo",
      level: "SUPRANATIONAL_DIRECTORY",
    });
    expect(authority.level).toBe("SUPRANATIONAL_DIRECTORY");
  });

  it("rejects an unknown authority level", () => {
    expect(() =>
      authorityDefinitionSchema.parse({ ...ripreeAuthority, level: "OFFICIAL" }),
    ).toThrow();
  });
});

describe("sourceDescriptorSchema", () => {
  it("separates authority, registry, and publication", () => {
    const descriptor = sourceDescriptorSchema.parse({
      ...baseDescriptor,
      reuse: statutoryReuse,
    });

    expect(descriptor.authorityId).toBe("es-miteco");
    expect(descriptor.registry.url).toContain("ExportarEmpresas/Export");
    expect(descriptor.publication.connector).toBe("es-ripree");
    expect(descriptor.reuse.status).toBe("statutory");
    expect(descriptor.reuse.legalBasis?.name).toContain("Law 37/2007");
    expect(descriptor.reuse.licence).toBeNull();
  });

  it("applies safety defaults on the publication", () => {
    const descriptor = sourceDescriptorSchema.parse({ ...baseDescriptor, reuse: statutoryReuse });
    expect(descriptor.publication.safety.maxDeletionRatio).toBe(0.2);
    expect(descriptor.publication.safety.acceptedDeletionKeys).toEqual([]);
  });

  it("requires exactly one of authorityId and an inline authority", () => {
    expect(() =>
      sourceDescriptorSchema.parse({
        ...baseDescriptor,
        authority: ripreeAuthority,
        reuse: statutoryReuse,
      }),
    ).toThrow();

    const { authorityId: _omitted, ...withoutAuthority } = baseDescriptor;
    expect(() =>
      sourceDescriptorSchema.parse({ ...withoutAuthority, reuse: statutoryReuse }),
    ).toThrow();
  });

  it("rejects the removed license field", () => {
    expect(() =>
      sourceDescriptorSchema.parse({
        ...baseDescriptor,
        license: { status: "unknown", name: null, url: null },
        reuse: unspecifiedReuse,
      }),
    ).toThrow();
  });
});

describe("resolveSourceDefinitions", () => {
  const authorities = [
    authorityDefinitionSchema.parse(ripreeAuthority),
    authorityDefinitionSchema.parse({
      id: "benelux-idro",
      name: "Benelux IDRO",
      level: "AUTHORITATIVE",
      jurisdictions: ["BE", "NL", "LU"],
      homepageUrl: "https://www.benelux-idro.eu/",
    }),
  ];

  it("lets several sources reference one authority without duplicating its metadata", () => {
    const descriptors = [
      sourceDescriptorSchema.parse({
        ...baseDescriptor,
        id: "benelux-export",
        authorityId: "benelux-idro",
        registry: {
          ...baseDescriptor.registry,
          url: "https://www.benelux-idro.eu/en/id-register/export",
        },
        publication: { ...baseDescriptor.publication, connector: "benelux-idro" },
        reuse: unspecifiedReuse,
      }),
      sourceDescriptorSchema.parse({
        ...baseDescriptor,
        id: "benelux-html",
        authorityId: "benelux-idro",
        registry: { ...baseDescriptor.registry, url: "https://www.benelux-idro.eu/en/id-register" },
        publication: {
          ...baseDescriptor.publication,
          connector: "benelux-idro",
          machineReadableUrl: null,
        },
        reuse: unspecifiedReuse,
      }),
    ];

    const resolved = resolveSourceDefinitions(descriptors, authorities);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.authority).toBe(resolved[1]?.authority);
    expect(sourceJurisdictions(resolved[0]!)).toEqual(["BE", "NL", "LU"]);
  });

  it("lets a registry narrow the jurisdictions of its authority", () => {
    const descriptor = sourceDescriptorSchema.parse({
      ...baseDescriptor,
      id: "benelux-lu",
      authorityId: "benelux-idro",
      registry: { ...baseDescriptor.registry, jurisdictions: ["LU"] },
      reuse: unspecifiedReuse,
    });

    const [resolved] = resolveSourceDefinitions([descriptor], authorities);
    expect(sourceJurisdictions(resolved!)).toEqual(["LU"]);
  });

  it("rejects a registry jurisdiction outside its authority scope", () => {
    const descriptor = sourceDescriptorSchema.parse({
      ...baseDescriptor,
      id: "benelux-fr",
      authorityId: "benelux-idro",
      registry: { ...baseDescriptor.registry, jurisdictions: ["FR"] },
      reuse: unspecifiedReuse,
    });

    expect(() => resolveSourceDefinitions([descriptor], authorities)).toThrow(/FR/);
  });

  it("names the unknown authority when a reference cannot be resolved", () => {
    const descriptor = sourceDescriptorSchema.parse({
      ...baseDescriptor,
      authorityId: "does-not-exist",
      reuse: unspecifiedReuse,
    });

    expect(() => resolveSourceDefinitions([descriptor], authorities)).toThrow(/does-not-exist/);
  });

  it("reports a non-authoritative source as such", () => {
    const { authorityId: _omitted, ...withoutAuthorityId } = baseDescriptor;
    const descriptor = sourceDescriptorSchema.parse({
      ...withoutAuthorityId,
      authority: { ...ripreeAuthority, id: "eu-eafo", level: "SUPRANATIONAL_DIRECTORY" },
      reuse: unspecifiedReuse,
    });

    const [resolved] = resolveSourceDefinitions([descriptor], authorities);
    expect(resolved?.authority.level).toBe("SUPRANATIONAL_DIRECTORY");
    expect(isAuthoritative(resolved!)).toBe(false);
  });

  it("rejects an inline authority whose id collides with a catalogued one", () => {
    // Downstream consumers key authorities by id, so the loser would be silently
    // overwritten in the import bundle.
    const { authorityId: _omitted, ...withoutAuthorityId } = baseDescriptor;
    const descriptor = sourceDescriptorSchema.parse({
      ...withoutAuthorityId,
      authority: { ...ripreeAuthority, id: "benelux-idro" },
      reuse: unspecifiedReuse,
    });

    expect(() => resolveSourceDefinitions([descriptor], authorities)).toThrow(/benelux-idro/);
  });

  it("rejects a duplicate id inside the authority catalog", () => {
    const twice = [...authorities, authorityDefinitionSchema.parse(ripreeAuthority)];
    expect(() => resolveSourceDefinitions([], twice)).toThrow(/es-miteco/);
  });

  it("keeps an inline authority local to its source", () => {
    const { authorityId: _omitted, ...withoutAuthorityId } = baseDescriptor;
    const descriptor = sourceDescriptorSchema.parse({
      ...withoutAuthorityId,
      authority: { ...ripreeAuthority, id: "es-miteco-inline" },
      reuse: unspecifiedReuse,
    });

    const [resolved] = resolveSourceDefinitions([descriptor], authorities);
    expect(resolved?.authority.id).toBe("es-miteco-inline");
    expect(isAuthoritative(resolved!)).toBe(true);
  });
});

describe("the published source catalog", () => {
  it("resolves every descriptor against the authority catalog", async () => {
    const authorities = await loadAuthorityDefinitions();
    const sources = await loadSourceDefinitions();

    expect(authorities.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.authority.name.length).toBeGreaterThan(0);
      expect(sourceJurisdictions(source).length).toBeGreaterThan(0);
    }
  });

  it("exposes structured publications consumed by connectors", async () => {
    const sources = await loadSourceDefinitions();
    const machineReadableUrls = Object.fromEntries(
      sources
        .filter((source) => source.publication.machineReadableUrl)
        .map((source) => [source.id, source.publication.machineReadableUrl]),
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
  });

  it("keeps every published source authoritative for its registry", async () => {
    const sources = await loadSourceDefinitions();
    expect(sources.every((source) => isAuthoritative(source))).toBe(true);
    expect(
      sources.every((source) => source.registry.observationType === "OFFICIAL_ASSIGNMENT"),
    ).toBe(true);
  });

  it("describes the Spanish statutory reuse basis", async () => {
    const sources = await loadSourceDefinitions();
    const spain = sources.find((source) => source.id === "es-ripree");

    expect(spain?.reuse).toMatchObject({
      status: "statutory",
      legalBasis: {
        name: expect.stringContaining("Law 37/2007"),
        url: "https://www.boe.es/eli/es/l/2007/11/16/37/con",
      },
    });
  });

  it("separates the Latvian authority from its machine-readable publication", async () => {
    const sources = await loadSourceDefinitions();
    const latvia = sources.find((source) => source.id === "lv-lvceli");

    expect(latvia).toMatchObject({
      authority: {
        name: "SLLC Latvijas Valsts ceļi",
        level: "AUTHORITATIVE",
        homepageUrl: "https://www.transportdata.gov.lv/en/idro",
      },
      registry: {
        url: "https://www.transportdata.gov.lv/api/v1/content/en/idro?_format=json",
      },
      publication: {
        machineReadableUrl: "https://www.transportdata.gov.lv/api/v1/content/en/idro?_format=json",
        verifiedAt: "2026-07-10",
      },
    });
  });

  it("keeps the Finnish authority distinct from the Fintraffic access point", async () => {
    const sources = await loadSourceDefinitions();
    const finland = sources.find((source) => source.id === "fi-traficom");

    expect(finland).toMatchObject({
      name: "Traficom IDRO register",
      authority: {
        name: "Finnish Transport and Communications Agency Traficom",
        homepageUrl:
          "https://www.traficom.fi/en/transport-system/sustainable-transport/apply-afir-id-charging-point-operator-andor-mobility-service-provider",
      },
      registry: {
        url: "https://www.traficom.fi/en/transport-system/sustainable-transport/apply-afir-id-charging-point-operator-andor-mobility-service-provider",
      },
      publication: {
        machineReadableUrl: null,
        verifiedAt: "2026-07-25",
      },
      reuse: {
        status: "licensed",
        legalBasis: null,
        licence: {
          name: "CC BY 4.0",
          url: "https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data",
        },
        attributionNotice: expect.stringContaining(
          "Finnish Transport and Communications Agency Traficom",
        ),
        redistributionAllowed: true,
      },
      notes: expect.stringContaining("Fintraffic"),
    });
  });

  it("keeps the Irish register PDF separate from the TII authority page", async () => {
    const sources = await loadSourceDefinitions();
    const ireland = sources.find((source) => source.id === "ie-tii");

    expect(ireland).toMatchObject({
      name: "TII IDRO Public Register",
      authority: {
        name: "Transport Infrastructure Ireland",
        homepageUrl:
          "https://www.tii.ie/en/roads-tolling/alt-fuel-projects-unit/alt-fuels-data-office/register-idro/",
      },
      registry: {
        url: "https://www.tii.ie/media/pqigaadi/idro-public-register-19-march-2026.pdf",
      },
      publication: {
        machineReadableUrl: null,
        verifiedAt: "2026-07-25",
      },
      reuse: {
        status: "licensed",
        legalBasis: null,
        licence: {
          name: "CC BY 4.0",
          url: "https://www.tii.ie/en/compliance/reuse-of-public-sector-information/",
        },
        attributionNotice:
          "Contains Irish Public Sector Information licensed under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence",
        redistributionAllowed: true,
      },
      notes: expect.stringContaining("S.I. No. 52 of 2026"),
    });
  });
});

describe("liftLegacyDescriptor", () => {
  it("accepts a legacy flat descriptor and lifts it into the new shape", () => {
    const descriptor = parseLegacy({
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
      reuse: statutoryReuse,
    });

    expect(descriptor.authorityId).toBeUndefined();
    expect(descriptor.authority).toMatchObject({
      name: "Ministerio para la Transicion Ecologica y el Reto Demografico",
      level: "AUTHORITATIVE",
      jurisdictions: ["ES"],
      homepageUrl: "https://energia.serviciosmin.gob.es/RIPREE",
    });
    expect(descriptor.registry.url).toBe(
      "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/Export",
    );
    expect(descriptor.registry.observationType).toBe("OFFICIAL_ASSIGNMENT");
    expect(descriptor.publication.verifiedAt).toBe("2026-07-10");
  });

  it("maps a non-official legacy descriptor to a secondary directory entry", () => {
    const descriptor = parseLegacy({
      id: "xx-directory",
      name: "Third-party directory",
      authorityName: "Third-party directory",
      jurisdictions: ["XX"],
      official: false,
      homepageUrl: "https://example.org/",
      registryUrl: "https://example.org/register",
      machineReadableUrl: null,
      verifiedAt: null,
      connector: "xx-directory",
      enabled: false,
      refreshSchedule: "weekly",
      supportedRoles: ["CPO"],
      reuse: unspecifiedReuse,
    });

    expect(descriptor.authority?.level).toBe("SECONDARY");
    expect(descriptor.registry.observationType).toBe("OFFICIAL_DIRECTORY_ENTRY");
  });

  it("rejects a legacy descriptor whose official flag is not a boolean", () => {
    // YAML 1.2 parses `official: yes` as the string "yes". Coercing it would
    // silently downgrade an appointed authority to SECONDARY.
    expect(() =>
      parseLegacy({
        id: "xx-directory",
        name: "Third-party directory",
        authorityName: "Third-party directory",
        jurisdictions: ["XX"],
        official: "yes",
        homepageUrl: "https://example.org/",
        registryUrl: "https://example.org/register",
        machineReadableUrl: null,
        verifiedAt: null,
        connector: "xx-directory",
        enabled: false,
        refreshSchedule: "weekly",
        supportedRoles: ["CPO"],
        reuse: unspecifiedReuse,
      }),
    ).toThrow();
  });

  it("rejects a descriptor that mixes the legacy and structured shapes", () => {
    expect(() =>
      parseLegacy({
        ...baseDescriptor,
        registryUrl: "https://energia.serviciosmin.gob.es/Ripree/ExportarEmpresas/Export",
        reuse: statutoryReuse,
      }),
    ).toThrow();
  });
});
