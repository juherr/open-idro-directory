import type { CountryStats } from "../../src/application/mappers.js";
import { SCHEMA_VERSION } from "../../src/domain/constants.js";
import type { DatasetRelease, SourceRow } from "../../src/infrastructure/d1/types.js";

export const release: DatasetRelease = {
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

export function sourceRow(
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

export const tii = {
  id: "ie-tii",
  name: "Transport Infrastructure Ireland",
  jurisdictions: ["IE"],
};
export const evRoam = { id: "gb-evroam", name: "EV Roam", jurisdictions: ["GB", "IE"] };
export const cyEms = { id: "cy-ems", name: "Cyprus EMS", jurisdictions: ["CY"] };
export const benelux = {
  id: "benelux-idro",
  name: "Benelux IDRO",
  jurisdictions: ["BE", "NL", "LU"],
};

export const sources = [
  sourceRow("benelux-idro", benelux),
  sourceRow("cy-ems", cyEms, {
    machine_readable_url: null,
    // As in releases imported before the disabled-status fix: health stale, freshness disabled.
    health_status: "stale",
    freshness_status: "disabled",
    record_count: 0,
    last_attempted_at: null,
    last_successful_at: null,
  }),
  sourceRow("gb-evroam", evRoam, { last_successful_at: "2026-11-16T05:30:00.000Z" }),
  sourceRow("ie-tii", tii, { health_status: "stale", freshness_status: "stale" }),
];

export const noStats: CountryStats = { statuses: [], roles: [], observations: [], conflicts: 0 };

export const irishStats: CountryStats = {
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
