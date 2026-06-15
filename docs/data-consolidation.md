# Data Consolidation

The API separates source observations from consolidated party views.

A party is keyed by `countryCode + partyId`. It is a computed lookup entity, not a verified legal identity. Observations remain source-specific and preserve provenance.

Preferred organization name selection:

1. Prefer authoritative source data.
2. Prefer active observations.
3. Prefer the most recently retrieved observation.
4. Use source ID and role as deterministic tie-breakers.

Role and party status rules:

- `ACTIVE` wins when at least one official role observation is active.
- `REVOKED`, `INACTIVE`, and `RESERVED` require explicit source status.
- Absence from a source is not treated as revocation.
- Conflicts are exposed as diagnostics and do not silently overwrite data.

Alternative names, statuses, and source values remain available through observations.
