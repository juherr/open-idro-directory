# Open IDRO Directory

Open IDRO Directory aggregates, normalizes, validates, and publishes e-mobility identifiers from official national or regional IDRO registries.

> Open IDRO Directory is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.

The project uses the European Alternative Fuels Observatory's [Identification Registration Repository (IDRR)](https://alternative-fuels-observatory.ec.europa.eu/markets-and-policy/policy-insights/identification-registration-repository) as a reference for identifying relevant IDROs and planning broader source coverage. The IDRR is not treated as a substitute for provenance from each originating registry.

## Supported Sources

The EAFO IDRR directory is used as a coverage planning reference. Records are
published only when a source connector preserves provenance from the originating
registry.

<!-- BEGIN GENERATED SUPPORTED SOURCES -->
<!-- prettier-ignore -->
| Source or IDRR entry | Coverage status | Mechanism | Licence / reuse basis |
| --- | --- | --- | --- |
| Ladestellen.at (`at-ladestellen`) | Supported: 🇦🇹 | Public JSON endpoint used by Ladestellen.at's admin UI | Undetermined |
| AFIREV (`fr-afirev`) | Supported: 🇫🇷 | Public JSON endpoint used by AFIREV's embedded directory | Undetermined |
| Benelux IDRO (`benelux-idro`) | Supported: 🇧🇪, 🇳🇱; 🇱🇺 via regional source | Public CSV export from the ID register | Undetermined |
| Croatian IDRO (`hr-croidro`) | Supported: 🇭🇷 | Public CSV export from the ID register | Undetermined |
| Cyprus EMS (`cy-ems`) | IDRO known; list unavailable: 🇨🇾 | Temporary EMS page; no identifier list found yet | Undetermined |
| Danish Road Traffic Authority (`dk-fstyr`) | Supported: 🇩🇰 | Public HTML table from the IDRO registration page | Undetermined |
| BDEW (`de-bdew`) | Supported: 🇩🇪 | Public paginated JSON endpoint | Undetermined |
| Traficom IDRO register (`fi-traficom`) | Supported: 🇫🇮 | Public HTML table from the AFIR ID page | [CC BY 4.0](https://traficom.fi/en/transport-system/geoinformationsmaterial/use-and-licences-data) |
| Hellenic IDRO (`gr-electrokinisi`) | Supported: 🇬🇷 | Public HTML table from the ID-register page | Undetermined |
| Hungarian IDRO (`hu-idro`) | Supported: 🇭🇺 | Public HTML list from the members page | Undetermined |
| TII IDRO Public Register (`ie-tii`) | Supported: 🇮🇪 | Public PDF register | [CC BY 4.0](https://www.tii.ie/en/compliance/reuse-of-public-sector-information/) |
| LVC IDRO Register (`lv-lvceli`) | Supported: 🇱🇻 | Public Drupal JSON page with embedded HTML table | No explicit reuse terms identified (reviewed 2026-07-10) |
| Via Lietuva public charging data (`lt-vialietuva`) | Supported: 🇱🇹 | Public OCPI locations endpoint for CPO identifiers | [CC BY 4.0 / ODC-BY](https://ev.vialietuva.lt/atviri-duomenys-1) |
| EIPA (`pl-eipa`) | Supported: 🇵🇱 | Public CSV export from the registered entities list | Undetermined |
| MOBI.E IDACS (`pt-mobie`) | Supported: 🇵🇹 | Public PDF register | Undetermined |
| RIPREE (`es-ripree`) | Supported: 🇪🇸 | Public XML export from the company register export page | Statutory - [Spanish Law 37/2007 on reuse of public-sector information](https://www.boe.es/eli/es/l/2007/11/16/37/con) |
| Slovenian NAP IDRO (`si-nap`) | Supported: 🇸🇮 | Public XLSX national repository from NAP | Undetermined |
| SuisseEnergie Swiss ID register (`ch-suisseenergie`) | Supported: 🇨🇭 (Non-EU) | Public Gatsby page-data JSON endpoint | Undetermined |
| Swedish Energy Agency IDRO (`se-energimyndigheten`) | Supported: 🇸🇪 | Public XLSX registers for CPO and EMSP identifiers | Undetermined |
| EV Roam (`gb-evroam`) | Supported: 🇬🇧 (Non-EU) | Public JSON API with official GB and cross-register IE identifiers | Undetermined |
| Bulgaria | Coming soon: 🇧🇬 | Awaiting IDRR data | Not applicable - source pending |
| Czechia | Coming soon: 🇨🇿 | Awaiting IDRR data | Not applicable - source pending |
| Estonia | Coming soon: 🇪🇪 | Awaiting IDRR data | Not applicable - source pending |
| Italy | Coming soon: 🇮🇹 | Awaiting IDRR data | Not applicable - source pending |
| Luxembourg national IDRO | Coming soon: 🇱🇺 | Awaiting IDRR data | Not applicable - source pending |
| Malta | Coming soon: 🇲🇹 | Awaiting IDRR data | Not applicable - source pending |
| Romania | Coming soon: 🇷🇴 | Awaiting IDRR data | Not applicable - source pending |
| Slovakia | Coming soon: 🇸🇰 | Awaiting IDRR data | Not applicable - source pending |

<!-- END GENERATED SUPPORTED SOURCES -->

## Generated Datasets

- `data/registry.json`: pretty JSON array.
- `data/registry.min.json`: minified JSON array.
- `data/registry.ndjson`: one normalized record per line.
- `data/registry.csv`: stable tabular export.
- `data/registry-invalid.json`: entries excluded from the published lists --
  `records` whose eMI3 identifier is invalid, and `rows` a connector could not
  read as an identifier at all -- each with the reason that rejected it.
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
bun run directory sources
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

## Reuse Warning

Open IDRO Directory is an open-source project, and its source code uses Apache
License 2.0. The aggregated registry data is collected from upstream sources and
may remain subject to those sources' own rights and reuse terms. Source
provenance and the applicable reuse basis are preserved where known; unspecified
terms are displayed explicitly and must not be treated as open-data permission. This is an
engineering note, not legal advice.

## Contributing

Read `docs/adding-a-source.md` before adding a connector. Use official APIs or downloads before HTML parsing, keep connector-specific logic isolated, and add deterministic fixture tests.

The supported-sources table is generated from `config/sources/*.yaml`. Run
`bun run docs:sync` after changing a source descriptor; the unit suite rejects a
README table that is out of sync.

## Roadmap

Delivery is tracked in the
[Open IDRO Directory roadmap](https://github.com/users/juherr/projects/4).

- [v0.2 — Trusted source metadata](https://github.com/juherr/open-idro-directory/milestone/1):
  correct authority feedback, complete source metadata, and prevent documentation
  drift.
- [v0.3 — Country discovery](https://github.com/juherr/open-idro-directory/milestone/2):
  expose country-level authority, source, provenance, and identifier discovery.
- [v0.4 — IDRO interoperability](https://github.com/juherr/open-idro-directory/milestone/3):
  define interoperable publication, history, embedding, and authority
  collaboration capabilities.

GitHub issues use labels for type, area, priority, dependency status, and size.
Only decision-complete and unblocked issues enter the roadmap's `Ready` state.
