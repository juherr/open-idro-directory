-- Issue #52: keep the roles each registry declares, so a country summary can tell
-- a role the national register does not publish from one it publishes but has no
-- entries for. NULL until the first import after this migration.

ALTER TABLE sources ADD COLUMN supported_roles_json TEXT;
