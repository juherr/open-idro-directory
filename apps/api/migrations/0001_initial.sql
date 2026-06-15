CREATE TABLE dataset_releases (
  id TEXT PRIMARY KEY,
  git_commit_sha TEXT NOT NULL,
  git_ref TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  dataset_checksum TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  source_count INTEGER NOT NULL,
  importer_version TEXT NOT NULL
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  authority_name TEXT,
  authority_level TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  official INTEGER NOT NULL,
  homepage_url TEXT,
  registry_url TEXT,
  jurisdictions_json TEXT NOT NULL,
  license_status TEXT NOT NULL,
  license_name TEXT,
  license_url TEXT,
  health_status TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  last_attempted_at TEXT,
  last_successful_at TEXT,
  last_changed_at TEXT,
  freshness_status TEXT NOT NULL,
  latest_error_summary TEXT,
  source_checksum TEXT,
  dataset_release_id TEXT NOT NULL,
  FOREIGN KEY(dataset_release_id) REFERENCES dataset_releases(id)
);

CREATE TABLE parties (
  key TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  party_id TEXT NOT NULL,
  emobility_id TEXT NOT NULL,
  preferred_name TEXT,
  legal_name TEXT,
  website TEXT,
  consolidated_status TEXT NOT NULL,
  highest_authority_level TEXT NOT NULL,
  role_count INTEGER NOT NULL,
  observation_count INTEGER NOT NULL,
  has_conflict INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  dataset_release_id TEXT NOT NULL,
  UNIQUE(dataset_release_id, country_code, party_id),
  FOREIGN KEY(dataset_release_id) REFERENCES dataset_releases(id)
);

CREATE TABLE party_roles (
  party_key TEXT NOT NULL,
  role TEXT NOT NULL,
  consolidated_status TEXT NOT NULL,
  highest_authority_level TEXT NOT NULL,
  observation_count INTEGER NOT NULL,
  has_conflict INTEGER NOT NULL,
  dataset_release_id TEXT NOT NULL,
  PRIMARY KEY(party_key, role, dataset_release_id),
  FOREIGN KEY(party_key) REFERENCES parties(key),
  FOREIGN KEY(dataset_release_id) REFERENCES dataset_releases(id)
);

CREATE TABLE observations (
  key TEXT PRIMARY KEY,
  party_key TEXT NOT NULL,
  source_id TEXT NOT NULL,
  scheme TEXT NOT NULL,
  country_code TEXT NOT NULL,
  party_id TEXT NOT NULL,
  emobility_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  organization_name TEXT,
  legal_name TEXT,
  website TEXT,
  source_record_id TEXT,
  source_value TEXT NOT NULL,
  source_url TEXT NOT NULL,
  authority_level TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  raw_record_checksum TEXT,
  dataset_release_id TEXT NOT NULL,
  FOREIGN KEY(party_key) REFERENCES parties(key),
  FOREIGN KEY(source_id) REFERENCES sources(id),
  FOREIGN KEY(dataset_release_id) REFERENCES dataset_releases(id)
);

CREATE TABLE conflicts (
  key TEXT PRIMARY KEY,
  party_key TEXT NOT NULL,
  role TEXT,
  conflict_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  details_json TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  dataset_release_id TEXT NOT NULL,
  FOREIGN KEY(party_key) REFERENCES parties(key),
  FOREIGN KEY(dataset_release_id) REFERENCES dataset_releases(id)
);

CREATE TABLE active_dataset (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  dataset_release_id TEXT NOT NULL
);

CREATE INDEX idx_parties_emobility_id ON parties(dataset_release_id, emobility_id);
CREATE INDEX idx_parties_country_party ON parties(dataset_release_id, country_code, party_id);
CREATE INDEX idx_parties_name ON parties(dataset_release_id, normalized_name);
CREATE INDEX idx_parties_status ON parties(dataset_release_id, consolidated_status);
CREATE INDEX idx_parties_authority ON parties(dataset_release_id, highest_authority_level);
CREATE INDEX idx_parties_cursor ON parties(dataset_release_id, country_code, party_id);
CREATE INDEX idx_party_roles_role ON party_roles(dataset_release_id, role);
CREATE INDEX idx_observations_party ON observations(dataset_release_id, party_key);
CREATE INDEX idx_observations_source ON observations(dataset_release_id, source_id);
CREATE INDEX idx_observations_country_party ON observations(dataset_release_id, country_code, party_id);
CREATE INDEX idx_observations_role ON observations(dataset_release_id, role);
CREATE INDEX idx_observations_status ON observations(dataset_release_id, status);
CREATE INDEX idx_conflicts_party ON conflicts(dataset_release_id, party_key);
CREATE INDEX idx_conflicts_severity ON conflicts(dataset_release_id, severity);
