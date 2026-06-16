# Open IDRO Directory

Open IDRO Directory aggregates, normalizes, validates, and publishes e-mobility identifiers from official national or regional IDRO registries.

> Open IDRO Directory is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.

The project uses the European Alternative Fuels Observatory's [Identification Registration Repository (IDRR)](https://alternative-fuels-observatory.ec.europa.eu/markets-and-policy/policy-insights/identification-registration-repository) as a reference for identifying relevant IDROs and planning broader source coverage. The IDRR is not treated as a substitute for provenance from each originating registry.

## Supported Sources

The EAFO IDRR directory is used as a coverage planning reference. Records are
published only when a source connector preserves provenance from the originating
registry.

| Source or IDRR entry                           | Coverage status                           | Mechanism                                                          | License            |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ | ------------------ |
| Ladestellen.at (`at-ladestellen`)              | Supported: 🇦🇹                             | Public JSON endpoint used by Ladestellen.at's admin UI             | Unknown            |
| AFIREV (`fr-afirev`)                           | Supported: 🇫🇷                             | Public JSON endpoint used by AFIREV's embedded directory           | Unknown            |
| Benelux IDRO (`benelux-idro`)                  | Supported: 🇧🇪, 🇳🇱; 🇱🇺 via regional source | Public CSV export from the ID register                             | Unknown            |
| Croatian IDRO (`hr-croidro`)                   | Supported: 🇭🇷                             | Public CSV export from the ID register                             | Unknown            |
| Cyprus EMS (`cy-ems`)                          | IDRO known; list unavailable: 🇨🇾          | Temporary EMS page; no identifier list found yet                   | Unknown            |
| Danish Road Traffic Authority (`dk-fstyr`)     | Supported: 🇩🇰                             | Public HTML table from the IDRO registration page                  | Unknown            |
| BDEW (`de-bdew`)                               | Supported: 🇩🇪                             | Public paginated JSON endpoint                                     | Unknown            |
| Traficom (`fi-traficom`)                       | Supported: 🇫🇮                             | Public HTML table from the AFIR ID page                            | Unknown            |
| Hellenic IDRO (`gr-electrokinisi`)             | Supported: 🇬🇷                             | Public HTML table from the ID-register page                        | Unknown            |
| Hungarian IDRO (`hu-idro`)                     | Supported: 🇭🇺                             | Public HTML list from the members page                             | Unknown            |
| TII IDRO Public Register (`ie-tii`)            | Supported: 🇮🇪                             | Public PDF register                                                | Unknown            |
| LVC IDRO Register (`lv-lvceli`)                | Supported: 🇱🇻                             | Public Drupal JSON page with embedded HTML table                   | Unknown            |
| Via Lietuva (`lt-vialietuva`)                  | Supported: 🇱🇹                             | Public OCPI locations endpoint for CPO identifiers                 | CC BY 4.0 / ODC-BY |
| EIPA (`pl-eipa`)                               | Supported: 🇵🇱                             | Public CSV export from the registered entities list                | Unknown            |
| MOBI.E IDACS (`pt-mobie`)                      | Supported: 🇵🇹                             | Public PDF register                                                | Unknown            |
| RIPREE (`es-ripree`)                           | Supported: 🇪🇸                             | Public XML export from the company register export page            | Unknown            |
| Slovenian NAP IDRO (`si-nap`)                  | Supported: 🇸🇮                             | Public XLSX national repository from NAP                           | Unknown            |
| SuisseEnergie (`ch-suisseenergie`)             | Supported: 🇨🇭 (Non-EU)                    | Public Gatsby page-data JSON endpoint                              | Unknown            |
| Swedish Energy Agency (`se-energimyndigheten`) | Supported: 🇸🇪                             | Public XLSX registers for CPO and EMSP identifiers                 | Unknown            |
| EV Roam (`gb-evroam`)                          | Supported: 🇬🇧 (Non-EU)                    | Public JSON API with official GB and cross-register IE identifiers | Unknown            |
| Bulgaria                                       | Coming soon: 🇧🇬                           | Awaiting IDRR data                                                 | Unknown            |
| Czechia                                        | Coming soon: 🇨🇿                           | Awaiting IDRR data                                                 | Unknown            |
| Estonia                                        | Coming soon: 🇪🇪                           | Awaiting IDRR data                                                 | Unknown            |
| Italy                                          | Coming soon: 🇮🇹                           | Awaiting IDRR data                                                 | Unknown            |
| Luxembourg national IDRO                       | Coming soon: 🇱🇺                           | Awaiting IDRR data                                                 | Unknown            |
| Malta                                          | Coming soon: 🇲🇹                           | Awaiting IDRR data                                                 | Unknown            |
| Romania                                        | Coming soon: 🇷🇴                           | Awaiting IDRR data                                                 | Unknown            |
| Slovakia                                       | Coming soon: 🇸🇰                           | Awaiting IDRR data                                                 | Unknown            |

## Generated Datasets

- `data/registry.json`: pretty JSON array.
- `data/registry.min.json`: minified JSON array.
- `data/registry.ndjson`: one normalized record per line.
- `data/registry.csv`: stable tabular export.
- `data/sources.json`: source configuration and health.
- `data/stats.json`: aggregate counts.
- `data/reports/non-idrr-additions.json`: complementary observations absent from the
  official dataset.
- `data/reports/non-idrr-conflicts.json`: conflicts between complementary
  observations and official records.
- `data/reports/non-idrr-overlap.json`: complementary observations already present
  in official records.
- `data/reports/source-health.json`: source health summary for official and
  complementary pipelines.
- `data/reports/rejected-sources.json`: rejected, deferred, or spike-only
  complementary sources.
- `build/cloudflare/*`: reproducible Cloudflare D1 import bundle generated by
  `bun run api:build-import`.

## Public API

The Cloudflare API is a read-only query layer over the generated datasets. Git
remains the canonical, auditable source of records and provenance; D1 is a
rebuildable read model.

```bash
bun run api:build-import
bun run api:migrate:local
bun run api:import:local
bun run api:dev
bun run api:test
```

MVP endpoints include `/api/v1`, `/api/v1/health`, `/api/v1/dataset`,
`/api/v1/parties`, `/api/v1/sources`, `/api/v1/conflicts`, `/api/v1/stats`,
`/api/v1/resolve/{emobilityId}`, `/openapi.json`, and `/docs`.

See `docs/api-architecture.md`, `docs/api-reference.md`,
`docs/cloudflare-deployment.md`, and `docs/d1-import.md`.

## Quick Start

```bash
bun install
bun run directory update --source at-ladestellen
bun run directory update --source benelux-idro
bun run directory update --source dk-fstyr
bun run directory update --source de-bdew
bun run directory update --source es-ripree
bun run directory update --source fi-traficom
bun run directory update --source fr-afirev
bun run directory update --source gb-evroam
bun run directory update --source gr-electrokinisi
bun run directory update --source hu-idro
bun run directory update --source hr-croidro
bun run directory update --source ie-tii
bun run directory update --source lv-lvceli
bun run directory update --source lt-vialietuva
bun run directory update --source pl-eipa
bun run directory update --source pt-mobie
bun run directory update --source si-nap
bun run directory update --source ch-suisseenergie
bun run directory update --source se-energimyndigheten
bun run directory:non-idrr
bun run check
```

## CLI

```bash
bun run directory fetch
bun run directory fetch --source at-ladestellen
bun run directory fetch --source benelux-idro
bun run directory fetch --source dk-fstyr
bun run directory fetch --source de-bdew
bun run directory fetch --source es-ripree
bun run directory fetch --source fi-traficom
bun run directory fetch --source fr-afirev
bun run directory fetch --source gb-evroam
bun run directory fetch --source gr-electrokinisi
bun run directory fetch --source hu-idro
bun run directory fetch --source hr-croidro
bun run directory fetch --source ie-tii
bun run directory fetch --source lv-lvceli
bun run directory fetch --source lt-vialietuva
bun run directory fetch --source pl-eipa
bun run directory fetch --source pt-mobie
bun run directory fetch --source si-nap
bun run directory fetch --source ch-suisseenergie
bun run directory fetch --source se-energimyndigheten
bun run directory build
bun run directory validate
bun run directory update
bun run directory non-idrr:reports
bun run directory diff
bun run directory stats
bun run api:build-import
bun run api:test
bun run api:typecheck
```

## Data Model

Each record contains a stable key, normalized `countryCode`, `partyId`, `eMobilityId`, role, status, organization data, source provenance, and source-specific metadata. Roles are kept as separate records when a source publishes a combined type. The stable key includes the originating `registryId`, so overlapping claims from different sources, such as Irish identifiers published by both TII and EV Roam, remain separate records with separate provenance instead of overwriting each other. When a country has official IDRO records in the dataset, non-official active claims for that country are retained with unknown status; the official IDRO decides whether the identifier is active. For EV Roam, GB records are marked official and active; IE cross-register records are retained as non-official unknown-status observations because TII is the Irish registrar.

Complementary non-IDRR data uses `IdentifierObservation` records instead of
official registry records. Observations explicitly preserve identifier scheme,
authority level, observation type, evidence URL, confidence score, and reasons.
OCPI party IDs, EVSE prefixes, hub IDs, national IDs, and eMI3 IDs are not merged
without explicit alias evidence.

## Provenance And Freshness

Every normalized value keeps the originating registry ID, source URL, exact source value, retrieval timestamp, and raw snapshot checksum. A failed source does not erase previously generated records; it is marked stale in `sources.json`.

## License Warning

Open IDRO Directory is an open-source project, and its source code uses Apache
License 2.0. The aggregated registry data is collected from upstream sources and
may remain subject to those sources' own rights, terms, and licenses. Source
provenance and license status are preserved where known; unknown licensing is
displayed explicitly and must not be treated as open-data permission. This is an
engineering note, not legal advice.

## Contributing

Read `docs/adding-a-source.md` before adding a connector. Use official APIs or downloads before HTML parsing, keep connector-specific logic isolated, and add deterministic fixture tests.

## Roadmap

- Milestone 2: non-IDRR source investigation, EVSEID.eu portal matrix, public
  infrastructure observations, conflict reporting, historical observations.
- Milestone 3: GitHub Pages search, country-specific static JSON, lookup pages, health dashboard.
- Milestone 4: broader IDRO coverage guided by the EAFO IDRR, source owner workflow, signed releases, public change feed.
