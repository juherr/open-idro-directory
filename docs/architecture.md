# Architecture

The MVP uses a small ports-and-adapters structure.

- Domain modules define source descriptors, normalized records, and validation issues.
- Connectors own source-specific fetch, parse, and normalize logic.
- Application services orchestrate fetching, building, validation, diffs, and reports.
- Infrastructure modules handle HTTP, filesystem snapshots, and serialization.

AFIREV implementation plan:

1. Inspect `https://afirev.fr/prefixes/consulter-l-annuaire/`.
2. Follow the official iframe to `https://app.afirev.fr/embed/annuaire`.
3. Inspect the public Angular bundle and identify `https://api.afirev.fr/public/prefixes`.
4. Fetch that JSON endpoint directly because it is the stable public endpoint used by the official site.
5. Preserve `data/raw/fr-afirev/current/body.json` and metadata.
6. Parse rows with Zod, normalize roles/statuses, validate, and generate deterministic static datasets.

Raw retention keeps the current successful snapshot and the previous successful snapshot. Fixture snapshots used by tests are committed separately under `tests/fixtures`.

Vite+ note: this repository uses the `vp` CLI and local `vite-plus` package. `vp check` replaces separate ESLint and Prettier commands for format, lint, and type-check validation.

## Non-IDRR Extension Pipeline

Complementary sources use a parallel observation model. Official source
connectors continue to produce `NormalizedRegistryRecord` values for
`data/registry.*`. Observation connectors produce `IdentifierObservation` values
and diagnostics under `data/reports/*`.

The separation prevents secondary observations, public infrastructure evidence,
OCPI endpoint metadata, and roaming-network memberships from overwriting official
IDRO assignments. The CLI command `bun run directory:non-idrr` generates the
current non-IDRR reports without fetching or mutating official source snapshots.
