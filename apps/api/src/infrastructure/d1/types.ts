export interface DatasetRelease {
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
  authority_level: string;
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
  consolidated_status: string;
  highest_authority_level: string;
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
  role: string;
  consolidated_status: string;
  highest_authority_level: string;
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
  role: string;
  status: string;
  organization_name: string | null;
  legal_name: string | null;
  website: string | null;
  source_record_id: string | null;
  source_value: string;
  source_url: string;
  authority_level: string;
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
  role: string | null;
  conflict_type: string;
  severity: string;
  summary: string;
  details_json: string;
  source_ids_json: string;
  detected_at: string;
  dataset_release_id: string;
}
