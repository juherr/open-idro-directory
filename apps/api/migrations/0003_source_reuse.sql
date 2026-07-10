ALTER TABLE sources ADD COLUMN machine_readable_url TEXT;
ALTER TABLE sources ADD COLUMN verified_at TEXT;
ALTER TABLE sources ADD COLUMN reuse_status TEXT NOT NULL DEFAULT 'unspecified';
ALTER TABLE sources ADD COLUMN reuse_legal_basis_name TEXT;
ALTER TABLE sources ADD COLUMN reuse_legal_basis_url TEXT;
ALTER TABLE sources ADD COLUMN reuse_licence_name TEXT;
ALTER TABLE sources ADD COLUMN reuse_licence_url TEXT;
ALTER TABLE sources ADD COLUMN reuse_attribution_notice TEXT;
ALTER TABLE sources ADD COLUMN reuse_redistribution_allowed INTEGER;
ALTER TABLE sources ADD COLUMN reuse_notes TEXT;

ALTER TABLE sources DROP COLUMN license_status;
ALTER TABLE sources DROP COLUMN license_name;
ALTER TABLE sources DROP COLUMN license_url;
