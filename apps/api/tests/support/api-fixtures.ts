import { SCHEMA_VERSION } from "../../src/domain/constants.js";
import type {
  ConflictRow,
  DatasetRelease,
  ObservationRow,
  PartyRoleRow,
  PartyRow,
  SourceRow,
} from "../../src/infrastructure/d1/types.js";

/**
 * One release with one French party, its role, source, observation and conflict, served by a
 * D1 fake that matches the repository's SQL. Shared by `api.test.ts` and the api-client's
 * in-process contract test.
 */
export const release: DatasetRelease = {
  id: "release-1",
  git_commit_sha: "abc123",
  git_ref: "main",
  generated_at: "2026-06-15T06:39:47.501Z",
  imported_at: "1970-01-01T00:00:00.000Z",
  dataset_checksum: "checksum-1",
  schema_version: SCHEMA_VERSION,
  record_count: 1,
  source_count: 1,
  importer_version: "0.1.0",
};

export const party: PartyRow = {
  key: "FR:ABC",
  country_code: "FR",
  party_id: "ABC",
  emobility_id: "FRABC",
  preferred_name: "Example Mobility",
  legal_name: "Example Legal Group",
  website: "https://example.com",
  consolidated_status: "ACTIVE",
  highest_authority_level: "AUTHORITATIVE",
  role_count: 1,
  observation_count: 1,
  has_conflict: 0,
  first_seen_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: "2026-01-01T00:00:00.000Z",
  normalized_name: "example mobility",
  normalized_legal_name: "example legal group",
  dataset_release_id: release.id,
};

export const role: PartyRoleRow = {
  party_key: party.key,
  role: "CPO",
  consolidated_status: "ACTIVE",
  highest_authority_level: "AUTHORITATIVE",
  observation_count: 1,
  has_conflict: 0,
  issuing_confirmation: "CONFIRMED",
  issuing_confirmed_by_json: '["fr-afirev"]',
  dataset_release_id: release.id,
};

export const source: SourceRow = {
  id: "fr-afirev",
  name: "AFIREV",
  authority_id: "fr-afirev",
  authority_name: "AFIREV",
  authority_level: "AUTHORITATIVE",
  authority_jurisdictions_json: '["FR"]',
  authority_homepage_url: "https://afirev.fr/",
  authority_notes: null,
  observation_type: "OFFICIAL_ASSIGNMENT",
  official: 1,
  homepage_url: "https://afirev.fr/",
  registry_url: "https://api.afirev.fr/public/prefixes",
  jurisdictions_json: '["FR"]',
  supported_roles_json: '["CPO","EMSP"]',
  machine_readable_url: "https://api.afirev.fr/public/prefixes",
  verified_at: "2026-01-02",
  reuse_status: "licensed",
  reuse_legal_basis_name: null,
  reuse_legal_basis_url: null,
  reuse_licence_name: "CC BY 4.0",
  reuse_licence_url: "https://creativecommons.org/licenses/by/4.0/",
  reuse_attribution_notice: "Cite the source.",
  reuse_redistribution_allowed: 1,
  reuse_notes: null,
  health_status: "current",
  record_count: 1,
  last_attempted_at: "2026-01-01T00:00:00.000Z",
  last_successful_at: "2026-01-01T00:00:00.000Z",
  last_changed_at: null,
  freshness_status: "current",
  latest_error_summary: null,
  source_checksum: "source-checksum",
  dataset_release_id: release.id,
};

export const observation: ObservationRow = {
  key: "fr-afirev:FR:ABC:CPO",
  party_key: party.key,
  source_id: source.id,
  scheme: "EMI3_OPERATOR_ID",
  country_code: "FR",
  party_id: "ABC",
  emobility_id: "FRABC",
  role: "CPO",
  status: "ACTIVE",
  organization_name: "Example Mobility",
  legal_name: null,
  website: "https://example.com",
  source_record_id: "ABC",
  source_value: "FRABC",
  source_url: "https://api.afirev.fr/public/prefixes",
  authority_level: "AUTHORITATIVE",
  observation_type: "OFFICIAL_ASSIGNMENT",
  first_seen_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: "2026-01-01T00:00:00.000Z",
  retrieved_at: "2026-01-01T00:00:00.000Z",
  metadata_json: "{}",
  raw_record_checksum: null,
  observation_kind: "ASSIGNMENT",
  observing_jurisdiction: "FR",
  dataset_release_id: release.id,
};

export const conflict: ConflictRow = {
  key: "conflict-1",
  party_key: party.key,
  role: "CPO",
  conflict_type: "IDENTIFIER_HOLDER_MISMATCH",
  severity: "HIGH",
  summary: "Observed holder differs from official holder.",
  details_json: "{}",
  source_ids_json: '["fr-afirev"]',
  detected_at: "2026-01-01T00:00:00.000Z",
  dataset_release_id: release.id,
};

export interface FakeD1Options {
  activeRelease?: DatasetRelease | null;
}

export function fakeD1(options: FakeD1Options = {}): D1Database {
  const activeRelease = options.activeRelease === undefined ? release : options.activeRelease;
  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => statement(sql, params, activeRelease),
      first: async <T>() => first<T>(sql, [], activeRelease),
      all: async <T>() => ({ results: all<T>(sql, []) }),
    }),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function statement(sql: string, params: unknown[], activeRelease: DatasetRelease | null) {
  return {
    first: async <T>() => first<T>(sql, params, activeRelease),
    all: async <T>() => ({ results: all<T>(sql, params) }),
  };
}

export function first<T>(
  sql: string,
  params: unknown[],
  activeRelease: DatasetRelease | null,
): T | null {
  if (sql.includes("FROM active_dataset")) return activeRelease as T;
  if (sql.includes("FROM parties") && sql.includes("country_code = ?") && params.includes("ABC"))
    return party as T;
  if (sql.includes("FROM sources") && sql.includes("id = ?")) return source as T;
  if (sql.includes("SELECT") && sql.includes("AS parties")) {
    return { parties: 1, observations: 2, conflicts: 1 } as T;
  }
  if (sql.includes("FROM conflicts") && sql.includes("party_key LIKE ?"))
    return { count: params.includes("FR:%") ? 1 : 0 } as T;
  return null;
}

function all<T>(sql: string, params: unknown[]): T[] {
  // Country-scoped aggregates first: the broader matchers below ignore the country.
  if (sql.includes("country_code = ?") && sql.includes("GROUP BY")) {
    if (!params.includes("FR")) return [];
    if (sql.includes("GROUP BY consolidated_status")) return [{ key: "ACTIVE", count: 1 }] as T[];
    if (sql.includes("GROUP BY pr.role")) return [{ key: "CPO", count: 1 }] as T[];
    if (sql.includes("GROUP BY source_id, authority_level"))
      return [{ source_id: "fr-afirev", authority_level: "AUTHORITATIVE", count: 2 }] as T[];
  }
  if (sql.includes("FROM parties p")) {
    if (params.some((param) => String(param).includes("legal group"))) {
      return sql.includes("p.normalized_legal_name") ? ([party] as T[]) : [];
    }
    return [party] as T[];
  }
  if (sql.includes("FROM party_roles")) return [role] as T[];
  if (sql.includes("FROM observations") && sql.includes("GROUP BY country_code"))
    return [{ key: "FR", count: 2 }] as T[];
  if (sql.includes("FROM observations")) return [observation] as T[];
  if (sql.includes("FROM conflicts")) return [conflict] as T[];
  if (sql.includes("FROM sources s") && !sql.includes("s.id = ?")) return [source] as T[];
  if (sql.includes("GROUP BY country_code")) return [{ key: "FR", count: 1 }] as T[];
  if (sql.includes("GROUP BY role")) return [{ key: "CPO", count: 1 }] as T[];
  if (sql.includes("GROUP BY consolidated_status")) return [{ key: "ACTIVE", count: 1 }] as T[];
  if (sql.includes("GROUP BY highest_authority_level"))
    return [{ key: "AUTHORITATIVE", count: 1 }] as T[];
  if (sql.includes("record_count AS count")) return [{ key: "fr-afirev", count: 1 }] as T[];
  if (sql.includes("GROUP BY severity")) return [{ key: "HIGH", count: 1 }] as T[];
  return [];
}
