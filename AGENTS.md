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

## Build, Test, and Development Commands

Use Bun as the package manager.

- `bun install`: install dependencies.
- `bun run build`: run TypeScript compilation.
- `bun run test`: run Vitest once.
- `bun run check`: run VitePlus format/lint/type checks, tests, and registry validation.
- `bun run registry fetch --source <id>`: fetch one source snapshot.
- `bun run registry build`: normalize enabled sources and write `data/`.
- `bun run registry update --source <id>`: fetch, build, validate, and write a change report.
- `bun run registry validate`: validate generated registry data.

The Irish `ie-tii` connector parses a PDF register and requires `pdftotext`
from Poppler (`brew install poppler` on macOS, `apt-get install poppler-utils`
on Ubuntu).

## Coding Style & Naming Conventions

The project uses TypeScript ESM and VitePlus for formatting, linting, and type checks. Keep code ASCII unless an upstream fixture or organization name requires Unicode. Prefer small connector-specific modules: `<name>.connector.ts`, `<name>.parser.ts`, and `<name>.types.ts`. Source IDs use lowercase kebab-case, for example `dk-fstyr`.

Run `bunx vp check --fix` or `bun run format` before committing when formatting fails.

## Testing Guidelines

Tests use Vitest. Add focused unit tests for every parser and normalizer, with fixtures under `tests/fixtures/<source-id>/`. Cover malformed rows, duplicate identifiers, role mapping, source URLs, and generated key formats. Run `bun run test` for tests only, or `bun run check` before finalizing.

## Commit & Pull Request Guidelines

Commits must follow Conventional Commits, enforced by commitlint. Use messages such as `feat: add Danish IDRO registry support` or `fix: preserve registry source URLs`.

Pull requests should describe the source, provenance URL, data format, generated record counts, safety implications, and validation results. Link related issues when available. Include screenshots only for UI changes.

## Source & Data Safety

Prefer official APIs or downloads before HTML parsing. Preserve upstream provenance in each record. Do not weaken safety thresholds to bypass failures; investigate stale sources, mass changes, and fallback pages. Read `docs/adding-a-source.md` and `docs/source-policy.md` before adding a new registry.
