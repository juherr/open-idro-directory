import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildImportBundle, toOfficialObservations, writeImportBundle } from "./bundle.js";

describe("Cloudflare import bundle", () => {
  it("builds deterministic active-release rows from generated data", async () => {
    const bundle = await buildImportBundle();
    expect(bundle.release.record_count).toBe(bundle.observations.length);
    expect(bundle.manifest.files["observations.ndjson"]?.rows).toBe(bundle.observations.length);
    expect(bundle.parties.length).toBeGreaterThan(0);
    expect(bundle.observations[0]?.dataset_release_id).toBe(bundle.release.id);
    expect(bundle.sources.every((source) => source.reuse_status.length > 0)).toBe(true);
    expect(bundle.sources).not.toContainEqual(
      expect.objectContaining({ license_status: expect.anything() }),
    );
    expect(bundle.sources).toContainEqual(
      expect.objectContaining({
        id: "fi-traficom",
        reuse_status: "licensed",
        reuse_licence_name: "CC BY 4.0",
        reuse_licence_url:
          "https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data",
        reuse_attribution_notice: expect.stringContaining("Traficom"),
        reuse_redistribution_allowed: 1,
      }),
    );
    expect(bundle.sources).toContainEqual(
      expect.objectContaining({
        id: "ie-tii",
        reuse_status: "licensed",
        reuse_licence_name: "CC BY 4.0",
        reuse_licence_url: "https://www.tii.ie/en/compliance/reuse-of-public-sector-information/",
        reuse_attribution_notice:
          "Contains Irish Public Sector Information licensed under a Creative Commons Attribution 4.0 International (CC BY 4.0) licence",
        reuse_redistribution_allowed: 1,
      }),
    );
  });

  it("emits one authority row per authority and takes levels from the descriptor", async () => {
    const bundle = await buildImportBundle();

    expect(bundle.authorities).toContainEqual(
      expect.objectContaining({
        id: "fi-traficom",
        name: "Finnish Transport and Communications Agency Traficom",
        level: "AUTHORITATIVE",
        homepage_url: expect.stringContaining("traficom.fi"),
      }),
    );

    // Every source resolves to a catalogued authority, and the catalog is not
    // simply one row per source -- it is keyed on the authority itself.
    const authorityIds = bundle.authorities.map((authority) => authority.id);
    expect(authorityIds).toEqual([...authorityIds].sort());
    expect(bundle.authorities.length).toBeLessThanOrEqual(bundle.sources.length);

    const finland = bundle.sources.find((source) => source.id === "fi-traficom");
    expect(finland).toMatchObject({
      authority_id: "fi-traficom",
      authority_level: "AUTHORITATIVE",
      observation_type: "OFFICIAL_ASSIGNMENT",
    });
    for (const source of bundle.sources) {
      expect(authorityIds).toContain(source.authority_id);
    }
  });

  it("carries a non-authoritative level that the old boolean could not express", () => {
    // The five-level taxonomy only differs from the old boolean when a source is
    // not AUTHORITATIVE. No published source is, so this uses a synthetic one --
    // reinstating `official ? "AUTHORITATIVE" : "SECONDARY"` fails here.
    const directory = {
      id: "eu-eafo",
      authority: { id: "eu-eafo", level: "SUPRANATIONAL_DIRECTORY" },
      registry: { observationType: "OFFICIAL_DIRECTORY_ENTRY" },
    } as never;
    const record = {
      key: "eu-eafo:FR:ABC:CPO",
      countryCode: "FR",
      partyId: "ABC",
      eMobilityId: "FRABC",
      role: "CPO",
      status: "ACTIVE",
      organization: { name: null, legalName: null, website: null },
      source: {
        registryId: "eu-eafo",
        official: true,
        sourceRecordId: null,
        sourceUrl: "https://example.org/register",
        sourceValue: "FRABC",
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      },
      metadata: {},
    } as never;

    const [observation] = toOfficialObservations([record], [directory], "release-1");

    expect(observation?.authority_level).toBe("SUPRANATIONAL_DIRECTORY");
    expect(observation?.observation_type).toBe("OFFICIAL_DIRECTORY_ENTRY");
  });

  it("takes observation authority levels from the descriptor, not from a boolean", async () => {
    const bundle = await buildImportBundle();
    const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));

    // Regression guard: observation rows used to hardcode
    // `official ? "AUTHORITATIVE" : "SECONDARY"`, collapsing the five-level
    // taxonomy. Records covered by their source's authority must now carry the
    // level and observation type that source actually declares.
    for (const observation of bundle.observations) {
      const source = sourceById.get(observation.source_id);
      expect(source).toBeDefined();
      if (observation.authority_level === "SECONDARY") continue;
      expect(observation.authority_level).toBe(source?.authority_level);
      expect(observation.observation_type).toBe(source?.observation_type);
    }

    // EV Roam is authoritative for GB but only cross-registers IE identifiers,
    // so the per-record downgrade must survive the descriptor lookup.
    const evroamIe = bundle.observations.filter(
      (observation) => observation.source_id === "gb-evroam" && observation.country_code === "IE",
    );
    expect(evroamIe.length).toBeGreaterThan(0);
    for (const observation of evroamIe) {
      expect(observation.authority_level).toBe("SECONDARY");
      expect(observation.observation_type).toBe("OFFICIAL_DIRECTORY_ENTRY");
    }
  });

  it("writes D1 remote-compatible import SQL", async () => {
    await writeImportBundle();

    const sql = await readFile("build/cloudflare/import.sql", "utf8");
    expect(sql).not.toMatch(/\bBEGIN\s+TRANSACTION\b/i);
    expect(sql).not.toMatch(/\bSAVEPOINT\b/i);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
    expect(
      sql.startsWith(
        [
          "DELETE FROM active_dataset;",
          "DELETE FROM conflicts;",
          "DELETE FROM observations;",
          "DELETE FROM party_roles;",
          "DELETE FROM parties;",
          "DELETE FROM sources;",
          "DELETE FROM authorities;",
          "DELETE FROM dataset_releases;",
        ].join("\n"),
      ),
    ).toBe(true);
    expect(sql).toContain("INSERT INTO active_dataset");
  });
});
