-- Issue #50: keep what the issuing register says about an identifier apart from
-- who observed it. The confirmation depends on the role, so it lives on
-- party_roles; the issuing country is parties.country_code. confirmedBy is kept
-- per role too: a tombstoned assignment never confirms, so it cannot be rebuilt
-- from the observation rows. Each observation carries its kind (an assignment by
-- the issuing register or a listing by another one) and the jurisdiction of the
-- register that observed it. All four columns are NULL until the first import
-- after this migration; the confirmation columns also stay NULL for a dataset
-- published before the issuing block existed.

ALTER TABLE party_roles ADD COLUMN issuing_confirmation TEXT;
ALTER TABLE party_roles ADD COLUMN issuing_confirmed_by_json TEXT;
ALTER TABLE observations ADD COLUMN observation_kind TEXT;
ALTER TABLE observations ADD COLUMN observing_jurisdiction TEXT;
