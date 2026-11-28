# D1 Import

`packages/registry-import` builds a deterministic import bundle under `build/cloudflare`.

Generated files:

- `release.json`
- `authorities.ndjson`
- `sources.ndjson`
- `parties.ndjson`
- `party-roles.ndjson`
- `observations.ndjson`
- `conflicts.ndjson`
- `manifest.json`
- `checksums.sha256`
- `import.sql`

The bundle reads `data/registry.json`, `data/sources.json`, `data/stats.json`, and non-IDRR reports. Every registry record becomes an observation. An assignment by the register of the identifier's country carries its source's authority level and observation type; a listing of another country's identifier is `SECONDARY` and `OFFICIAL_DIRECTORY_ENTRY`. Parties and role projections are computed during import generation, not at request time: `highest_authority_level` is the strongest level among a party's or role's observations, and the preferred name comes from an assignment before any listing.

## Migration 0006

`apps/api/migrations/0006_issuing_confirmation.sql` adds four nullable columns:

- `party_roles.issuing_confirmation`: the record's `issuing.confirmation`, per
  role, since the confirmation depends on it;
- `party_roles.issuing_confirmed_by_json`: `issuing.confirmedBy` as a JSON
  array;
- `observations.observation_kind`: `ASSIGNMENT` or `CROSS_REGISTER_LISTING`;
- `observations.observing_jurisdiction`: the country of the register that
  published the observation.

The issuing country is `parties.country_code`, already present. All four columns
are `NULL` until the first import after the migration, and the confirmation
columns also stay `NULL` when the imported dataset predates the issuing block.
The API answers `null` for them meanwhile. Until that import,
`highest_authority_level` keeps the value the previous import wrote
(`AUTHORITATIVE` for every party); see the backward-compatibility notes in
`docs/api-reference.md`.

Commands:

```bash
bun run api:build-import
bun run --cwd packages/registry-import verify
bun run api:import:local
```

Failed checksum, row-count, uniqueness, or foreign-key checks must block activation. The generated SQL imports a release and then updates `active_dataset` in the same transaction.
