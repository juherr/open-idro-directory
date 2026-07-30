# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An authority catalog under `config/authorities/`. An appointed IDRO is now
  described once and referenced by every source it operates, so one organisation
  can back several registries without duplicated metadata.
- Nested `authority`, `registry`, and `publication` objects on `/sources`
  responses and in `data/sources.json`, plus an `authorities` table in the API
  database.
- Source-level authoritative provenance, machine-readable URLs, editorial
  verification dates, and explicit reuse mechanisms.
- A `directory sources` command that refreshes source metadata without
  rebuilding registry records or changing their timestamps.
- Statutory reuse details for Spain's RIPREE registry and verified authoritative
  provenance for the Latvian National Access Point register.
- Initial Open IDRO Directory MVP.

### Changed

- **Breaking:** source descriptors separate the appointed authority, the registry
  it operates, and the publication a connector consumes, instead of flattening
  all three into one object. Pre-existing flat descriptors are still accepted and
  lifted into the new shape automatically. Authoritativeness is now carried by
  `authority.level`; the `official` boolean survives in generated data and API
  responses but is derived from it rather than being the source of truth. No
  generated identifier record changed.
- **Breaking:** `data/sources.json` replaces its flat `authorityName`,
  `jurisdictions`, `homepageUrl`, `registryUrl`, `machineReadableUrl`,
  `verifiedAt`, `connector`, `supportedRoles`, and `enabled` fields with the
  nested `authority`, `registry`, and `publication` objects. `official` and
  `health` are unchanged. The API keeps its flat fields for schema 1.1.x
  consumers; this dataset artifact does not.
- Observation rows in the D1 import bundle now take their authority level and
  observation type from the source descriptor instead of deriving both from a
  boolean, so a non-`AUTHORITATIVE` source is no longer reported as authoritative.
  Records a source does not cover, such as the Irish identifiers cross-registered
  by EV Roam, stay `SECONDARY`.
- API schema version is now `1.2.0`, and the OpenAPI document version follows the
  same constant so the body, the `X-Registry-Schema-Version` header, and the
  document cannot drift apart.
- **Breaking:** replace the ambiguous source `license` contract with `reuse`,
  distinguishing explicit licences, statutory bases, granted permissions,
  restrictions, and unspecified terms.
- Correct Finnish source attribution and reuse metadata, distinguishing
  Traficom's IDRO register from Fintraffic's infrastructure-data publication
  role.
- Record TII's statutory appointment as the Irish IDRO and its CC BY 4.0
  public-sector information terms.
- Ladestellen.at source descriptor, connector, parser, normalization, and fixture-based tests.
- Benelux IDRO source descriptor, CSV export connector, parser, normalization, and fixture-based tests.
- Croatian IDRO source descriptor, CSV export connector, parser, normalization, and fixture-based tests.
- Danish Road Traffic Authority source descriptor, HTML table connector, parser, normalization, and fixture-based tests.
- BDEW source descriptor, paginated JSON API connector, parser, normalization, and fixture-based tests.
- Traficom source descriptor, HTML table connector, parser, normalization, and fixture-based tests.
- Hellenic IDRO source descriptor, HTML table connector, parser, normalization, and fixture-based tests.
- Hungarian IDRO source descriptor, HTML list connector, parser, normalization, and fixture-based tests.
- TII IDRO Public Register source descriptor, PDF register connector, parser, normalization, and fixture-based tests.
- LVC IDRO Register source descriptor, Drupal JSON connector, parser, normalization, and fixture-based tests.
- Via Lietuva source descriptor, OCPI locations connector, CPO normalization, and fixture-based tests.
- EIPA source descriptor, CSV export connector, parser, normalization, and fixture-based tests.
- MOBI.E IDACS source descriptor, PDF register connector, parser, normalization, and fixture-based tests.
- Slovenian NAP IDRO source descriptor, XLSX connector, parser, normalization, and fixture-based tests.
- SuisseEnergie source descriptor, Gatsby page-data JSON connector, parser, normalization, and fixture-based tests.
- Swedish Energy Agency source descriptor, XLSX connectors, parser, normalization, and tests.
- AFIREV source descriptor, connector, parser, normalization, and fixture-based tests.
- Disabled placeholder descriptors and connectors for Cyprus EMS, RIPREE, and EV Roam.
- Deterministic JSON, minified JSON, NDJSON, CSV, source summary, and stats generation.
- Raw source snapshot preservation with checksum and retrieval metadata.
- Registry validation, safety thresholds, and stale-source fallback behavior.
- CLI commands for fetch, build, validate, update, diff, and stats.
- GitHub Actions for CI and scheduled registry updates.
- VitePlus-based format, lint, and type checks.
- Commitlint Conventional Commits validation.
- Local VitePlus Git hooks for pre-commit, commit-message, and pre-push checks.
- Bun, mise, and VitePlus project configuration.

[unreleased]: https://github.com/OWNER/open-idro-directory/commits/HEAD
