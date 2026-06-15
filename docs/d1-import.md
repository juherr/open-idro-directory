# D1 Import

`packages/registry-import` builds a deterministic import bundle under `build/cloudflare`.

Generated files:

- `release.json`
- `sources.ndjson`
- `parties.ndjson`
- `party-roles.ndjson`
- `observations.ndjson`
- `conflicts.ndjson`
- `manifest.json`
- `checksums.sha256`
- `import.sql`

The bundle reads `data/registry.json`, `data/sources.json`, `data/stats.json`, and non-IDRR reports. Official registry records become `OFFICIAL_ASSIGNMENT` observations. Parties and role projections are computed during import generation, not at request time.

Commands:

```bash
bun run api:build-import
bun run --cwd packages/registry-import verify
bun run api:import:local
```

Failed checksum, row-count, uniqueness, or foreign-key checks must block activation. The generated SQL imports a release and then updates `active_dataset` in the same transaction.
