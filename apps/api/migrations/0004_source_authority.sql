-- Issue #46: separate the appointed IDRO authority from the registry it operates
-- and from the publication a connector consumes. One authority may back several
-- sources, so its metadata now lives in its own table instead of being repeated
-- on every source row.

CREATE TABLE authorities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  jurisdictions_json TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  notes TEXT,
  dataset_release_id TEXT NOT NULL,
  FOREIGN KEY(dataset_release_id) REFERENCES dataset_releases(id)
);

CREATE INDEX authorities_level_idx ON authorities(level);

ALTER TABLE sources ADD COLUMN authority_id TEXT REFERENCES authorities(id);

CREATE INDEX sources_authority_id_idx ON sources(authority_id);
