ALTER TABLE parties ADD COLUMN normalized_legal_name TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_parties_legal_name ON parties(dataset_release_id, normalized_legal_name);
