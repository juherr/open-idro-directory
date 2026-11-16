import { describe, expect, it } from "vitest";
import { countrySummaryPayload, type CountryStats } from "../src/application/mappers.js";
import { SCHEMA_VERSION } from "../src/domain/constants.js";
import { RegistryRepository } from "../src/infrastructure/d1/repository.js";
import type { DatasetRelease, SourceRow } from "../src/infrastructure/d1/types.js";

const release: DatasetRelease = {
  id: "release-1",
  git_commit_sha: "abc123",
  git_ref: "main",
  generated_at: "2026-11-16T06:00:00.000Z",
  imported_at: "1970-01-01T00:00:00.000Z",
  dataset_checksum: "checksum-1",
  schema_version: SCHEMA_VERSION,
  record_count: 0,
  source_count: 0,
  importer_version: "0.1.0",
};

function sourceRow(
  id: string,
  authority: { id: string; name: string; jurisdictions: string[] },
  overrides: Partial<SourceRow> = {},
): SourceRow {
  return {
    id,
    name: id,
    authority_id: authority.id,
    authority_name: authority.name,
    authority_level: "AUTHORITATIVE",
    joined_authority_name: authority.name,
    joined_authority_level: "AUTHORITATIVE",
    authority_jurisdictions_json: JSON.stringify(authority.jurisdictions),
    authority_homepage_url: `https://${authority.id}.example/`,
    authority_notes: null,
    observation_type: "OFFICIAL_ASSIGNMENT",
    official: 1,
    homepage_url: `https://${authority.id}.example/`,
    registry_url: `https://${id}.example/register`,
    machine_readable_url: `https://${id}.example/register.json`,
    verified_at: "2026-11-01",
    jurisdictions_json: JSON.stringify(authority.jurisdictions),
    supported_roles_json: '["CPO","EMSP"]',
    reuse_status: "unspecified",
    reuse_legal_basis_name: null,
    reuse_legal_basis_url: null,
    reuse_licence_name: null,
    reuse_licence_url: null,
    reuse_attribution_notice: null,
    reuse_redistribution_allowed: null,
    reuse_notes: null,
    health_status: "current",
    record_count: 1,
    last_attempted_at: "2026-11-16T05:00:00.000Z",
    last_successful_at: "2026-11-16T05:00:00.000Z",
    last_changed_at: null,
    freshness_status: "current",
    latest_error_summary: null,
    source_checksum: "checksum",
    dataset_release_id: release.id,
    ...overrides,
  };
}

const tii = { id: "ie-tii", name: "Transport Infrastructure Ireland", jurisdictions: ["IE"] };
const evRoam = { id: "gb-evroam", name: "EV Roam", jurisdictions: ["GB", "IE"] };
const cyEms = { id: "cy-ems", name: "Cyprus EMS", jurisdictions: ["CY"] };
const benelux = { id: "benelux-idro", name: "Benelux IDRO", jurisdictions: ["BE", "NL", "LU"] };

const sources = [
  sourceRow("benelux-idro", benelux),
  sourceRow("cy-ems", cyEms, {
    machine_readable_url: null,
    // As imported: the bundle marks a disabled source stale, its freshness says disabled.
    health_status: "stale",
    freshness_status: "disabled",
    record_count: 0,
    last_attempted_at: null,
    last_successful_at: null,
  }),
  sourceRow("gb-evroam", evRoam, { last_successful_at: "2026-11-16T05:30:00.000Z" }),
  sourceRow("ie-tii", tii, { health_status: "stale", freshness_status: "stale" }),
];

const noStats: CountryStats = { statuses: [], roles: [], observations: [], conflicts: 0 };

const irishStats: CountryStats = {
  statuses: [{ key: "ACTIVE", count: 80 }],
  roles: [
    { key: "CPO", count: 56 },
    { key: "EMSP", count: 46 },
  ],
  observations: [
    { source_id: "gb-evroam", authority_level: "SECONDARY", count: 76 },
    { source_id: "ie-tii", authority_level: "AUTHORITATIVE", count: 26 },
  ],
  conflicts: 3,
};

describe("country summary read model", () => {
  it("summarises a country with a known IDRO and no published identifiers", () => {
    const summary = countrySummaryPayload("CY", sources, noStats, release);

    expect(summary).toMatchObject({
      countryCode: "CY",
      authorities: [{ id: "cy-ems", name: "Cyprus EMS", sourceIds: ["cy-ems"] }],
      coverage: {
        status: "NO_PUBLISHED_IDENTIFIERS",
        declaredRoles: ["CPO", "EMSP"],
        publishedRoles: {},
      },
      statistics: { parties: 0, partyRoles: 0, observations: 0, conflicts: 0, countsByStatus: {} },
      freshness: { latestSuccessfulRetrievalAt: null, staleSourceIds: [] },
      datasetTimestamp: release.generated_at,
      links: {
        self: "/api/v1/countries/CY",
        parties: "/api/v1/parties?country=CY",
        conflicts: "/api/v1/conflicts?country=CY",
      },
    });
    expect(summary?.sources.map((source) => source.id)).toEqual(["cy-ems"]);
    expect(summary?.sources[0]).toMatchObject({
      health: { freshness: "disabled", recordCount: 0 },
      publication: { machineReadableUrl: null },
      countryObservations: { total: 0, byAuthorityLevel: {} },
    });
  });

  it("returns every authority and source covering a country without ranking them", () => {
    const summary = countrySummaryPayload("IE", sources, irishStats, release);

    expect(summary?.authorities.map((authority) => [authority.id, authority.sourceIds])).toEqual([
      ["gb-evroam", ["gb-evroam"]],
      ["ie-tii", ["ie-tii"]],
    ]);
    expect(
      summary?.sources.map((source) => [source.id, source.countryObservations.byAuthorityLevel]),
    ).toEqual([
      ["gb-evroam", { SECONDARY: 76 }],
      ["ie-tii", { AUTHORITATIVE: 26 }],
    ]);
    expect(summary).toMatchObject({
      coverage: { status: "PUBLISHED", publishedRoles: { CPO: 56, EMSP: 46 } },
      statistics: {
        parties: 80,
        partyRoles: 102,
        observations: 102,
        conflicts: 3,
        countsByStatus: { ACTIVE: 80 },
      },
    });
  });

  it("rolls freshness up across the country's sources", () => {
    const summary = countrySummaryPayload("IE", sources, irishStats, release);

    expect(summary?.freshness).toEqual({
      latestSuccessfulRetrievalAt: "2026-11-16T05:30:00.000Z",
      staleSourceIds: ["ie-tii"],
    });
  });

  it("resolves a member of a multi-country registry to that registry", () => {
    const summary = countrySummaryPayload("NL", sources, noStats, release);

    expect(summary?.authorities.map((authority) => authority.id)).toEqual(["benelux-idro"]);
    expect(summary?.sources.map((source) => source.id)).toEqual(["benelux-idro"]);
  });

  it("includes a source that published identifiers for a country it does not declare", () => {
    const stats: CountryStats = {
      ...noStats,
      observations: [{ source_id: "benelux-idro", authority_level: "SECONDARY", count: 2 }],
    };

    const summary = countrySummaryPayload("DE", sources, stats, release);

    expect(summary?.authorities).toEqual([]);
    expect(summary?.sources.map((source) => source.id)).toEqual(["benelux-idro"]);
    expect(summary?.coverage.declaredRoles).toBeNull();
  });

  it("reports declared roles as unknown until the supported-roles column is imported", () => {
    const unimported = sources.map((row) => ({ ...row, supported_roles_json: null }));

    const summary = countrySummaryPayload("CY", unimported, noStats, release);

    expect(summary?.coverage.declaredRoles).toBeNull();
    expect(summary?.sources[0]?.registry.supportedRoles).toBeNull();
  });

  it("declares only the roles a CPO-only register publishes", () => {
    const austria = { id: "at-econtrol", name: "E-Control", jurisdictions: ["AT"] };
    const rows = [sourceRow("at-ladestellen", austria, { supported_roles_json: '["CPO"]' })];

    expect(countrySummaryPayload("AT", rows, noStats, release)?.coverage.declaredRoles).toEqual([
      "CPO",
    ]);
  });

  it("does not know a country no source covers and no party carries", () => {
    expect(countrySummaryPayload("ZZ", sources, noStats, release)).toBeNull();
  });
});

describe("country statistics repository", () => {
  it("scopes every query to the release and to the country", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => {
          calls.push({ sql, params });
          return {
            first: async () => ({ count: 4 }),
            all: async () => ({ results: [{ key: "CPO", count: 2 }] }),
          };
        },
      }),
    } as unknown as D1Database;

    const stats = await new RegistryRepository(db).countryStats("release-1", "IE");

    expect(stats.conflicts).toBe(4);
    expect(calls).toHaveLength(4);
    for (const call of calls) expect(call.params[0]).toBe("release-1");
    const query = (fragment: string) => calls.find((call) => call.sql.includes(fragment));
    expect(query("FROM conflicts")?.params).toEqual(["release-1", "IE:%"]);
    expect(query("FROM party_roles")?.sql).toMatch(/JOIN parties p ON p\.key = pr\.party_key/);
    expect(query("FROM party_roles")?.params).toEqual(["release-1", "IE"]);
    expect(query("FROM observations")?.sql).toContain("GROUP BY source_id, authority_level");
    expect(query("FROM observations")?.params).toEqual(["release-1", "IE"]);
    expect(query("GROUP BY consolidated_status")?.params).toEqual(["release-1", "IE"]);
  });
});
