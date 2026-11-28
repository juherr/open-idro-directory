# Repository Guidelines

## Project Structure & Module Organization

This repository is a TypeScript pipeline for aggregating e-mobility IDRO registry data.

- `src/`: application code, CLI, connectors, domain models, validation, HTTP, filesystem, and serialization.
- `src/connectors/<source-id>/`: one isolated connector per upstream registry.
- `config/sources/*.yaml`: source descriptors, provenance URLs, roles, and safety thresholds.
- `data/`: generated registry exports (`registry.json`, `registry.csv`, `sources.json`, `stats.json`).
- `data/raw/`: raw snapshots; most are ignored except tracked fixtures required by the project.
- `tests/unit/` and `tests/integration/`: Vitest suites.
- `tests/fixtures/`: deterministic source fixtures.
- `docs/`: architecture, data model, source policy, and source onboarding notes.
- `apps/api/`: read-only Cloudflare Worker (Hono + D1) serving `/api/v1`, the landing page in `public/`, and server-rendered country pages in `src/http/pages/`; tests in `apps/api/tests/`. See `docs/api-architecture.md`. It keeps serving the website until the cutover to `apps/web` (#143).
- `apps/web/`: the Astro website on its own Worker (`open-idro-directory-web`, `@astrojs/cloudflare`), replacing the frontend of `apps/api` (epic #137). It reads the public API only, through the `API` service binding in SSR and same-origin `/api/v1` in the browser, never D1; on `workers.dev` and in `web:dev` it proxies `/api/*`, `/docs` and `/openapi.json` to that binding. Tests in `apps/web/tests/`. See `docs/decisions/0001-astro-web-frontend.md` and `docs/web-migration-inventory.md`.
- `docs/decisions/`: architecture decision records.
- `packages/registry-import/`: builds the D1 import bundle from `data/`; `packages/registry-model/`: the registry types it shares.

## Build, Test, and Development Commands

Use Bun as the package manager.

- `bun install --frozen-lockfile`: install dependencies as CI does. If it fails, `bun.lock` is out of sync with `package.json`: regenerate it with `bun install` and commit it on its own, rather than leaving a rewritten lockfile in the tree.
- `bun run build`: run TypeScript compilation.
- `bun run test`: run Vitest once.
- `bun run check`: run VitePlus format/lint/type checks, pipeline and API tests, the API type check, registry validation, the D1 import bundle build, then the web type check, tests and build.
- `bun run directory fetch --source <id>`: fetch one source snapshot.
- `bun run directory build`: normalize enabled sources and write `data/`.
- `bun run directory update --source <id>`: fetch, build, validate, and write a change report. The sources the run did not rebuild keep their published records and health.
- `bun run directory validate`: validate generated registry data.
- `bun run api:test` / `bun run api:typecheck`: API tests and type check.
- `bun run api:migrate:local`, `bun run api:import:local`, then `bun run api:dev`: run the Worker locally on a D1 database loaded from `data/`; `bun run api:smoke:local` checks it.
- `bun run web:dev`: run the website with `astro dev`, with this checkout's API as an auxiliary Worker in the same process, on the local D1 state of `api:dev` (load it with `api:migrate:local` and `api:import:local` first). Do not start `api:dev` or another `wrangler dev` next to it to serve the `API` binding: the machine-wide dev registry can bind it to another checkout's API.
- `bun run web:build` / `bun run web:test` / `bun run web:typecheck`: build the website, run its tests, and type-check it (`astro sync && tsc`).

The Irish `ie-tii` connector parses a PDF register and requires `pdftotext`
from Poppler (`brew install poppler` on macOS, `apt-get install poppler-utils`
on Ubuntu).

## Coding Style & Naming Conventions

The project uses TypeScript ESM and VitePlus for formatting, linting, and type checks. Keep code ASCII unless an upstream fixture or organization name requires Unicode. Prefer small connector-specific modules: `<name>.connector.ts`, `<name>.parser.ts`, and `<name>.types.ts`. Source IDs use lowercase kebab-case, for example `dk-fstyr`.

Run `bunx vp check --fix` or `bun run format` before committing when formatting fails.

Before changing caching in `apps/api`, read the caching part of `docs/api-architecture.md`: handlers run before any cache header so an error is never cached or answered `304`, errors carry `Cache-Control: no-store` and no ETag, ETags cover the release id and the dataset checksum (`datasetValidator`), and a country-page markup change bumps `COUNTRY_PAGE_VERSION` in `apps/api/src/http/app.ts`.

In `apps/web`, logic lives in `.ts` modules, typed and unit-tested; `.astro` files hold markup and thin wiring only. `web:typecheck` does not type-check `.astro` files: `astro check` refuses TypeScript 7 (follow-up #146).

## Testing Guidelines

Tests use Vitest. Add focused unit tests for every parser and normalizer, with fixtures under `tests/fixtures/<source-id>/`. Cover malformed rows, duplicate identifiers, role mapping, source URLs, and generated key formats. Run `bun run test` for tests only, or `bun run check` before finalizing.

API tests live in `apps/api/tests/`. Run one file with `bun run api:test -- tests/<file>` and pair it with `bun run api:typecheck`: Vitest does not type-check, so a type error otherwise surfaces only in `bun run check`.

A fixture captured verbatim from an upstream response must be listed in `fmt.ignorePatterns` in `vite.config.ts`. Formatting rewrites escaping and quoting, so a formatted capture stops matching what the source actually serves and the parser is then tested against something that does not exist.

## Commit & Pull Request Guidelines

Commits must follow Conventional Commits, enforced by commitlint. Use messages such as `feat: add Danish IDRO registry support` or `fix: preserve registry source URLs`.

Pull requests should describe the source, provenance URL, data format, generated record counts, safety implications, and validation results. Link related issues when available. Include screenshots only for UI changes.

## Source & Data Safety

The generated datasets in `data/` are published by the scheduled update workflow, not by hand: a code or connector change should not carry a full `data/` rebuild, whose diff is dominated by refreshed timestamps. When a change alters a source descriptor, run `bun run directory sources` to refresh `data/sources.json` metadata without rebuilding records, and let the next scheduled run republish the datasets.

Prefer official APIs or downloads before HTML parsing. Preserve upstream provenance in each record. Do not weaken safety thresholds to bypass failures; investigate stale sources, mass changes, and fallback pages. Read `docs/adding-a-source.md` and `docs/source-policy.md` before adding a new registry.
