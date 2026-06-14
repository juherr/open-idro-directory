# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Global eMobility ID Registry MVP.
- Ladestellen.at source descriptor, connector, parser, normalization, and fixture-based tests.
- Benelux IDRO source descriptor, CSV export connector, parser, normalization, and fixture-based tests.
- Croatian IDRO source descriptor, CSV export connector, parser, normalization, and fixture-based tests.
- Danish Road Traffic Authority source descriptor, HTML table connector, parser, normalization, and fixture-based tests.
- BDEW source descriptor, paginated JSON API connector, parser, normalization, and fixture-based tests.
- Traficom source descriptor, HTML table connector, parser, normalization, and fixture-based tests.
- AFIREV source descriptor, connector, parser, normalization, and fixture-based tests.
- Disabled placeholder descriptors and connectors for Cyprus EMS and EV Roam.
- Deterministic JSON, minified JSON, NDJSON, CSV, source summary, and stats generation.
- Raw source snapshot preservation with checksum and retrieval metadata.
- Registry validation, safety thresholds, and stale-source fallback behavior.
- CLI commands for fetch, build, validate, update, diff, and stats.
- GitHub Actions for CI and scheduled registry updates.
- VitePlus-based format, lint, and type checks.
- Commitlint Conventional Commits validation.
- Local VitePlus Git hooks for pre-commit, commit-message, and pre-push checks.
- Bun, mise, and VitePlus project configuration.

[unreleased]: https://github.com/OWNER/global-emobility-id-registry/commits/HEAD
