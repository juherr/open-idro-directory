# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cross-register listings: a national register that lists an identifier
  another country issued, such as `DK*MON` in the Swedish register or `NL*TNM`
  in the Polish one, is now published instead of being refused. `countryCode`
  stays the issuing country, taken from the identifier prefix; the listing
  register shows only in `source.registryId` and in a new optional
  `source.observation { kind, observingJurisdiction }` block, whose `kind` is
  `ASSIGNMENT` or `CROSS_REGISTER_LISTING`. Listings are published with
  `official: false`: being listed in Sweden does not make Sweden the issuer.
  `schemas/registry.schema.json` describes the block.
- Issuing confirmation: every record carries an `issuing { country,
confirmation, confirmedBy }` block saying what the registers of the
  identifier's own country say about it for that role. `confirmation` is
  `CONFIRMED` (the confirming registers in `confirmedBy`), `NOT_FOUND`,
  `SOURCE_UNAVAILABLE`, `SOURCE_STALE`, `UNSUPPORTED_ROLE`, or
  `NO_ISSUING_SOURCE`. A listing by another country's register never confirms,
  nor does a tombstone, and a register that failed or went stale is never read
  as proof of absence. The block is derived from the raw provenance, identical
  on every record of an identifier and role, and the same after a partial
  update as after a full build. It never counts as a record change, so its
  arrival does not trip the safety thresholds. `data/registry.csv`
  gains `issuingCountry`, `issuingConfirmation`, and `observationKind`,
  appended after `retrievedAt`, and `data/stats.json` gains
  `recordsByIssuingConfirmation`. API parties carry `issuingCountry` and
  `roles[].issuing { confirmation, confirmedBy }`; observations carry
  `observationKind` and `observingJurisdiction`. D1 migration `0006` adds the
  columns, which read `null` until the next import of data carrying these
  blocks. The OpenAPI document describes them in `Party` and `Observation`
  components. API schema version is now 1.4.0.
- `data/reports/discrepancies.json`, written on every build, full or partial:
  what the issuing registers and the other sources disagree on, grouped by
  country and by pair of issuing and observed register, for the IDRO
  authorities to review. It lists identifiers another source publishes that
  the issuing register does not, identifiers added to or removed from the
  issuing register, conflicting names, roles or statuses, duplicate and
  malformed identifiers, and sources that are stale or unavailable. Each
  finding carries a severity, a confidence, and the timestamped records it
  rests on. When the issuing register itself is stale or unavailable, an
  absence it cannot vouch for is reported as unverifiable rather than as a
  removal. Findings describe differences between registers; none of them
  claims an identifier is invalid. Plus a `schemas/discrepancies.schema.json`
  contract. Serving the report through the API is tracked in #120.
- Country pages at `/countries/{code}/`, rendered on the server so they work
  without JavaScript: the country's IDRO authorities, coverage, and sources,
  with an explained empty state for a country with a known IDRO but no
  published identifiers, such as Cyprus. The lowercase URL is canonical:
  uppercase codes, a missing trailing slash, or a redundant `country` query
  parameter redirect to it, and a `country` parameter naming another country
  returns `400`. Unknown countries and paths return `404`. Error pages are sent
  with `Cache-Control: no-store`. The generic explorer `/explore/` is unchanged.
- Identifier search on country pages, reusing the explorer and scoped to the
  page's country: the country is forced into every API call and is never read
  from or written to the URL. An identifier whose prefix belongs to another
  country, such as `DE*ABC` on `/countries/fr/`, runs no search and shows a
  notice naming that country, linked to its page when one exists. Without
  JavaScript the page keeps all its content.
- Country pages in French and English: `?lang=fr` serves French, English is
  the default, and any other value falls back to it. The page language, a meta
  description, a canonical URL per language, `hreflang` links (`en`, `fr`, and
  an `x-default` pointing to English), Open Graph tags, and a JSON-LD
  `BreadcrumbList` are all in the server-rendered HTML, built from the path
  country only. The redirect from an uppercase code keeps `?lang`, and a page
  in one language never answers `304` to a request for the other. Error pages
  stay in English.
- `GET /api/v1/countries/{countryCode}`: one summary per country, gathering
  every authority whose remit includes it, every source that declares it or
  publishes identifiers for it, role coverage, freshness, counts, and the dataset
  timestamp. Countries with a known IDRO but no published register, such as
  Cyprus, get a summary too. Several authorities covering one country are all
  listed. The per-source breakdown of observations by authority level shows which
  one is authoritative there. Unknown countries return `404 COUNTRY_NOT_FOUND`
  and malformed codes return `422 INVALID_COUNTRY_CODE`. API schema version is
  now 1.3.0.
- `registry.supportedRoles` on API sources: the roles a register declares it
  publishes. D1 migration `0005` adds the column. It reads `null` until the next
  import.
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

- **Breaking:** `data/registry.json` and `data/registry.csv` gain the
  cross-register listings connectors used to refuse, so a consumer filtering by
  `countryCode` now also sees what other registers list for that country. Keep
  `source.official` or `source.observation.kind === "ASSIGNMENT"` to leave them
  out; the two filters differ, as `docs/data-model.md` explains. Records
  published before the block carry no `source.observation`: derive it from the
  source's jurisdictions in `data/sources.json`. `outOfJurisdiction` in
  `data/registry-invalid.json` no longer grows; its existing entries stay.
  `data/reports/out-of-jurisdiction.json` and the out-of-jurisdiction counters
  of `data/stats.json` keep their shape but now count the published listings,
  which takes them from about 5 to about 75 entries.
- `gb-evroam` now covers `GB` only, while its authority keeps `GB` and `IE`:
  its Irish entries, once a special case in the connector, are ordinary
  listings of identifiers Ireland issues. A listing its register stops
  publishing is dropped rather than kept as an `INACTIVE` tombstone, which
  removes the few Irish EV Roam entries kept that way.
- A party's `highestAuthorityLevel` is now computed from its observations: a
  party only listed by registers outside its country is `SECONDARY`, which
  changes the results of `?authority=` and the authority grouping of `/stats`.
  Its `preferredName` comes from an assignment by its own country's register
  before any cross-register listing, however recent the listing is.
- The landing page's country cards open the country page instead of the
  explorer. The Cyprus card opens its country page, which links to the
  ministry, instead of the ministry's site.
- The landing page's country chips open the country page too, and the
  explorer's detail panel and context label link the country to its page. When the
  active language is French, the explorer's country links and the landing's
  country cards carry `?lang=fr`.
- The `/explore/` detail panel takes its authority level and observation type
  labels from the country page's wording. They are now translated in French,
  and three English labels change: `Supranational_directory` becomes
  `Supranational directory`, `Self_asserted` becomes `Self-asserted`, and
  `Self declaration` becomes `Self-declaration`.
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

- The explorer ignores a search response that arrives after a newer query,
  instead of letting it overwrite the newer results.
- Conditional requests answered `200` instead of `304` when `If-None-Match`
  listed several entity tags, was `*`, or held the weak form `W/"…"` of the
  current ETag. The header is now evaluated as a list with weak comparison.
- API errors raised while answering a request, such as `404 COUNTRY_NOT_FOUND`,
  went out with the dataset's one-hour `Cache-Control` and ETag, and sending
  that ETag back answered `304` for a resource that does not exist. Errors now
  carry `Cache-Control: no-store` and no ETag, and are never revalidated.
- The API reported a disabled source, such as Cyprus, with health status
  `stale`, because a source that is never retrieved is always flagged stale.
  It now reports `disabled`.
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
