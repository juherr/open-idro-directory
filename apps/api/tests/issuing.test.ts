import {
  authorityLevelSchema,
  issuingConfirmationSchema,
  observationKindSchema,
  observationTypeSchema,
  registryRoleSchema,
} from "@open-idro-directory/registry-model";
import { describe, expect, it } from "vitest";
import { observationPayload, partyPayload } from "../src/application/mappers.js";
import { SCHEMA_VERSION } from "../src/domain/constants.js";
import { createApp, type Env } from "../src/http/app.js";
import { openApiDocument } from "../src/openapi/document.js";
import { dkMon, frOld, issuingD1, nlTnm, noXyz } from "./support/issuing-fixtures.js";

type Party = {
  issuingCountry: string;
  preferredName: string;
  highestAuthorityLevel: string;
  roles: Array<{ role: string; issuing: { confirmation: string | null; confirmedBy: unknown } }>;
};
type Observation = {
  sourceId: string;
  observationKind: string | null;
  observingJurisdiction: string | null;
  authorityLevel: string;
};

async function get<T>(path: string) {
  const response = await createApp().request(path, undefined, {
    REGISTRY_DB: issuingD1(),
  } satisfies Env);
  expect(response.status, path).toBe(200);
  return ((await response.json()) as { data: T }).data;
}

describe("issuing confirmation in party responses", () => {
  it("keeps DK*MON issued in Denmark although Sweden lists it", async () => {
    const party = await get<Party>("/api/v1/parties/DK/MON");

    expect(party).toMatchObject({
      issuingCountry: "DK",
      preferredName: "Monta ApS",
      highestAuthorityLevel: "AUTHORITATIVE",
    });
    expect(party.roles).toEqual([
      expect.objectContaining({
        role: "CPO",
        issuing: { confirmation: "CONFIRMED", confirmedBy: ["dk-fstyr"] },
      }),
    ]);

    const observations = await get<{ items: Observation[] }>("/api/v1/parties/DK/MON/observations");
    expect(observations.items).toEqual([
      expect.objectContaining({
        sourceId: "dk-fstyr",
        observationKind: "ASSIGNMENT",
        observingJurisdiction: "DK",
      }),
      expect.objectContaining({
        sourceId: "se-energimyndigheten",
        observationKind: "CROSS_REGISTER_LISTING",
        observingJurisdiction: "SE",
        authorityLevel: "SECONDARY",
      }),
    ]);
  });

  it("keeps NL*TNM issued in the Netherlands although Poland lists it", async () => {
    const party = await get<Party>("/api/v1/parties/NL/TNM");
    expect(party.issuingCountry).toBe("NL");
    expect(party.roles[0]?.issuing).toEqual({
      confirmation: "CONFIRMED",
      confirmedBy: ["benelux-idro"],
    });

    const observations = await get<{ items: Observation[] }>("/api/v1/parties/NL/TNM/observations");
    expect(observations.items.map((item) => [item.sourceId, item.observingJurisdiction])).toEqual([
      ["benelux-idro", "NL"],
      ["pl-eipa", "PL"],
    ]);
  });

  it("reports a party whose country has no issuing register", async () => {
    const party = await get<Party>("/api/v1/parties/NO/XYZ");
    expect(party).toMatchObject({ issuingCountry: "NO", highestAuthorityLevel: "SECONDARY" });
    expect(party.roles[0]?.issuing).toEqual({
      confirmation: "NO_ISSUING_SOURCE",
      confirmedBy: [],
    });
  });

  it("answers null for the fields a row imported before migration 0006 lacks", async () => {
    const party = await get<Party>("/api/v1/parties/FR/OLD");
    expect(party.issuingCountry).toBe("FR");
    expect(party.roles[0]?.issuing).toEqual({ confirmation: null, confirmedBy: null });

    const observations = await get<{ items: Observation[] }>("/api/v1/parties/FR/OLD/observations");
    expect(observations.items[0]).toMatchObject({
      observationKind: null,
      observingJurisdiction: null,
    });
  });
});

type Schema = {
  type?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  description?: string;
};

describe("OpenAPI party and observation components", () => {
  const document = openApiDocument();
  const schemas = document.components.schemas as Record<string, Schema>;
  const party = schemas.Party as Schema;
  const role = schemas.PartyRole as Schema;
  const observation = schemas.Observation as Schema;

  it("is version 1.4.0", () => {
    expect(SCHEMA_VERSION).toBe("1.4.0");
    expect(document.info.version).toBe("1.4.0");
  });

  it("references the components from the party and observation responses", () => {
    const response = (path: string) => JSON.stringify(document.paths[path]?.get.responses["200"]);
    expect(response("/api/v1/parties/{countryCode}/{partyId}")).toContain(
      "#/components/schemas/Party",
    );
    expect(response("/api/v1/parties")).toContain("#/components/schemas/Party");
    expect(response("/api/v1/parties/{countryCode}/{partyId}/observations")).toContain(
      "#/components/schemas/Observation",
    );
  });

  it("enumerates the domain confirmation states and observation kinds", () => {
    expect(JSON.stringify(role.properties?.issuing)).toContain(
      "#/components/schemas/IssuingConfirmation",
    );
    const issuing = schemas.IssuingConfirmation as Schema;
    expect(issuing.required).toEqual(["confirmation", "confirmedBy"]);
    expect(issuing.properties?.confirmation?.enum).toEqual([
      ...issuingConfirmationSchema.options,
      null,
    ]);
    expect(observation.properties?.observationKind?.enum).toEqual([
      ...observationKindSchema.options,
      null,
    ]);
  });

  it("enumerates the domain authority levels and observation types", () => {
    const levels = [...authorityLevelSchema.options];
    expect(party.properties?.highestAuthorityLevel?.enum).toEqual(levels);
    expect(role.properties?.highestAuthorityLevel?.enum).toEqual(levels);
    expect(observation.properties?.authorityLevel?.enum).toEqual(levels);
    expect(observation.properties?.observationType?.enum).toEqual([
      ...observationTypeSchema.options,
    ]);
  });

  it("documents only roles the domain knows", () => {
    // The API publishes CPO and EMSP only, a subset of the domain roles.
    const roles: readonly string[] = registryRoleSchema.options;
    for (const schema of [role, observation]) {
      const documented = schema.properties?.role?.enum ?? [];
      expect(documented.length).toBeGreaterThan(0);
      expect(documented.filter((value) => !roles.includes(value as string))).toEqual([]);
    }
  });

  it("declares every property of the fixture payloads", () => {
    for (const scenario of [dkMon, nlTnm, noXyz, frOld]) {
      const payload = partyPayload(scenario.party, scenario.roles);
      expect(party.required?.slice().sort()).toEqual(Object.keys(payload).sort());
      expect(role.required?.slice().sort()).toEqual(Object.keys(payload.roles[0] ?? {}).sort());
      for (const row of scenario.observations) {
        expect(observation.required?.slice().sort()).toEqual(
          Object.keys(observationPayload(row)).sort(),
        );
      }
    }
    expect(Object.keys(party.properties ?? {}).sort()).toEqual(party.required?.slice().sort());
    expect(Object.keys(observation.properties ?? {}).sort()).toEqual(
      observation.required?.slice().sort(),
    );
  });

  it("documents the derived fields as derived", () => {
    for (const field of ["status", "highestAuthorityLevel", "hasConflict"]) {
      expect(party.properties?.[field]?.description, field).toMatch(/derived/i);
    }
    expect(JSON.stringify(schemas)).not.toMatch(/\binvalid\b/i);
  });
});
