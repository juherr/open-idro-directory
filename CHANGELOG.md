# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `outOfJurisdiction` in `data/registry-invalid.json`: the well-formed
  identifiers a register publishes for a country it does not administer, each
  with the `countryCode` it belongs to and the run it was first and last seen
  in. They are kept rather than discarded so the registries concerned can be
  told, and they can be filtered by register or by country. Counted in
  `data/stats.json` as `totalOutOfJurisdictionRows`,
  `outOfJurisdictionByRegistry`, and `outOfJurisdictionByCountry`.
- `data/reports/out-of-jurisdiction.json`, the same findings grouped by the
  register to contact: the appointed organisation and its landing page for each
  register, and, for every identifier, the registry appointed for the country it
  belongs to. It describes the current run, so a register that corrects its
  export drops out of the report while staying in the history.
- `data/registry-invalid.json`, an append-only history of everything the pipeline
  excluded from the published datasets: `records` whose eMI3 identifier is
  invalid, and `rows` a connector could not read as an identifier at all. Each
  entry records when the problem was first and last seen, plus a hand-written
  `supersededBy` naming the identifier that replaced it upstream -- or `null`
  when nothing did, which is how an uncorrected identifier stays visible. Plus a
  `schemas/registry-invalid.schema.json` contract.
- `totalInvalidRecords`, `invalidRecordsByReason`, `invalidRecordsByRegistry`,
  `totalRejectedRows`, and `rejectedRowsByRegistry` counters in
  `data/stats.json`, describing only what the current run detected so a corrected
  identifier stops being reported as a live problem. Rows a connector drops were
  previously reported nowhere, so a source publishing malformed identifiers
  shrank silently.
- `docs/open-idro-recommended-practices.md`, a public working draft for national
  IDRO services covering authoritative publication, machine-readable access,
  reuse terms, data quality, maturity levels, and the legal questions that remain
  open. Linked from the README.
- `docs/current-landscape.md`, the observed state of the registers this project
  consumes -- formats, reuse terms, role coverage, lifecycle status. Kept out of
  the recommendations so that the guidance stays stable while the landscape
  changes, and so that the guidance does not read as an assessment of individual
  IDRO organisations.
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

- The Slovenian NAP connector reads its workbook with `read-excel-file`, the
  library the pipeline already uses for the Swedish registers, instead of
  matching the sheet XML by hand.
- `read-excel-file` moves to 9.3.9. The reader was held back on 9.2 because
  9.3.0 could not read a workbook that stores its text inline rather than in a
  shared-string table -- which is how the Swedish registers publish theirs. That
  regression, reported from this project as
  [catamphetamine/read-excel-file#124](https://github.com/catamphetamine/read-excel-file/issues/124),
  is fixed in 9.3.9. The declared version range no longer admits the affected
  releases.
- `build/change-summary.md` and the update pull-request body report, per source,
  the values the run refused: `Unreadable values` and
  `Out-of-jurisdiction identifiers`, with the values themselves listed in the
  per-source details block. They replace a `Warnings` line that was hardcoded to
  zero. A refused value never becomes a record, so the added/updated/removed
  counts could not reveal it.
- **Breaking:** the published datasets now only contain valid eMI3 identifiers.
  A party ID must be exactly three uppercase alphanumeric characters; the former
  `UNCOMMON_PARTY_ID` warning accepted two to eight and let invalid records reach
  `data/registry.*`. Invalid records are excluded and reported as counters
  instead. Four inactive records leave the registry, the CSV, the NDJSON, and the
  public API.
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

### Fixed

- The Slovenian NAP connector read the cell that follows an empty one as the
  empty cell's value. Excel writes an empty cell as `<c r="B5" s="2"/>`, and the
  pattern matching cells consumed the self-closing element together with its
  neighbour, reporting the neighbour's shared-string index as a value. The
  register leaves the MSP column empty for CPO-only operators, so one CPO
  identifier was lost, one address was truncated, and two shared-string indexes
  were reported as unreadable values that appear nowhere in the register.
- The Swedish registers are no longer fetched through a URL that expires. The
  agency's CMS prefixes every asset link with a cache-busting segment it
  regenerates on each upload -- `/4ac461/` and `/49656a/` became `/49d640/` and
  `/49dc9c/` -- so the pinned URLs would eventually stop resolving. Both
  workbooks are now read from the plain `/globalassets/` path, which serves the
  same bytes and does not move, and the CPO workbook comes from the source
  descriptor instead of being repeated in the connector.
- An identifier of another country is no longer reported as unreadable. Ten of
  the fourteen values in the first published rejection report were well-formed
  identifiers that a national register happens to list -- Dutch, French and
  German ones in the Polish register, a Danish one in the Swedish register --
  which read as parser failures. Connectors now check the value against the
  jurisdictions the source declares and report
  `<CONNECTOR>_OUT_OF_JURISDICTION_IDENTIFIER` separately, leaving the rejection
  report to the values that genuinely could not be read.
- No connector publishes an identifier outside the jurisdictions its source
  declares. The three connectors that accept any country only enforced it
  implicitly, so a foreign identifier appearing upstream would have been
  attributed to the wrong register.
- A value a register publishes twice in one run is recorded once in the
  rejection history instead of appearing twice.
- A run restricted to one source no longer strips every other source from the
  published datasets. The `--source` option of `directory update` and
  `directory build` filters what is rebuilt, but both write global files, so
  they now republish the records and the health of the sources they left alone.
- A single unreachable registry no longer aborts the whole update. Each source
  is fetched independently, a source that failed keeps the records it was last
  published with and is reported as stale with the date it last answered, and
  the change summary lists the failures first. The run still fails when registry
  validation reports an error or when every selected source failed.
- The Swiss register stopped updating: SuisseEnergie replaced its Gatsby site,
  which removed the `page-data` JSON endpoint the connector read and moved the
  register page. The connector now reads the identifiers from the register
  page's embedded Astro island payload, where one organisation may hold several
  identifiers with their own CPO and EMP flags.
- Relocating a source no longer looks like an upstream mass change. Change
  safety comparisons ignore `source.sourceUrl`, which comes from the source
  descriptor rather than from the registry.
- One connector accepted party IDs of three to five characters, so overlong
  source values were split into four-character party IDs and published. It now
  matches every other connector and accepts exactly three.

[unreleased]: https://github.com/OWNER/open-idro-directory/commits/HEAD
