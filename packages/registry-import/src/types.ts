import type {
  AuthorityLevel,
  RegistryRole,
  RegistryStatus,
} from "../../registry-model/src/index.js";

export const API_SCHEMA_VERSION = "1.0.0";
export const IMPORTER_VERSION = "0.1.0";

export interface DatasetReleaseRow {
  id: string;
  git_commit_sha: string;
  git_ref: string;
  generated_at: string;
  imported_at: string;
  dataset_checksum: string;
  schema_version: string;
  record_count: number;
  source_count: number;
  importer_version: string;
}

export interface SourceRow {
  id: string;
  name: string;
  authority_name: string | null;
  authority_level: AuthorityLevel;
  observation_type: string;
  official: number;
  homepage_url: string | null;
  registry_url: string | null;
  jurisdictions_json: string;
  license_status: string;
  license_name: string | null;
  license_url: string | null;
  health_status: string;
  record_count: number;
  last_attempted_at: string | null;
  last_successful_at: string | null;
  last_changed_at: string | null;
  freshness_status: string;
  latest_error_summary: string | null;
  source_checksum: string | null;
  dataset_release_id: string;
}

export interface PartyRow {
  key: string;
  country_code: string;
  party_id: string;
  emobility_id: string;
  preferred_name: string | null;
  legal_name: string | null;
  website: string | null;
  consolidated_status: RegistryStatus;
  highest_authority_level: AuthorityLevel;
  role_count: number;
  observation_count: number;
  has_conflict: number;
  first_seen_at: string;
  last_seen_at: string;
  normalized_name: string;
  dataset_release_id: string;
}

export interface PartyRoleRow {
  party_key: string;
  role: RegistryRole;
  consolidated_status: RegistryStatus;
  highest_authority_level: AuthorityLevel;
  observation_count: number;
  has_conflict: number;
  dataset_release_id: string;
}

export interface ObservationRow {
  key: string;
  party_key: string;
  source_id: string;
  scheme: string;
  country_code: string;
  party_id: string;
  emobility_id: string;
  role: RegistryRole;
  status: RegistryStatus;
  organization_name: string | null;
  legal_name: string | null;
  website: string | null;
  source_record_id: string | null;
  source_value: string;
  source_url: string;
  authority_level: AuthorityLevel;
  observation_type: string;
  first_seen_at: string;
  last_seen_at: string;
  retrieved_at: string;
  metadata_json: string;
  raw_record_checksum: string | null;
  dataset_release_id: string;
}

export interface ConflictRow {
  key: string;
  party_key: string;
  role: RegistryRole | null;
  conflict_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  details_json: string;
  source_ids_json: string;
  detected_at: string;
  dataset_release_id: string;
}

export interface ImportManifest {
  schemaVersion: string;
  gitCommitSha: string;
  gitRef: string;
  generatedAt: string;
  datasetReleaseId: string;
  datasetChecksum: string;
  importerVersion: string;
  files: Record<string, { sha256: string; rows: number }>;
  recordCount: number;
  sourceCount: number;
}
