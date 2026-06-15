# Global eMobility ID Registry

Global eMobility ID Registry aggregates, normalizes, validates, and publishes e-mobility identifiers from official national or regional IDRO registries.

> Global eMobility ID Registry is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.

The project uses the European Alternative Fuels Observatory's [Identification Registration Repository (IDRR)](https://alternative-fuels-observatory.ec.europa.eu/markets-and-policy/policy-insights/identification-registration-repository) as a reference for identifying relevant IDROs and planning broader source coverage. The IDRR is not treated as a substitute for provenance from each originating registry.

## Supported Sources

| Source                                         | Status      | Mechanism                                                | License            |
| ---------------------------------------------- | ----------- | -------------------------------------------------------- | ------------------ |
| Ladestellen.at (`at-ladestellen`)              | Enabled     | Public JSON endpoint used by Ladestellen.at's admin UI   | Unknown            |
| AFIREV (`fr-afirev`)                           | Enabled     | Public JSON endpoint used by AFIREV's embedded directory | Unknown            |
| Benelux IDRO (`benelux-idro`)                  | Enabled     | Public CSV export from the ID register                   | Unknown            |
| Croatian IDRO (`hr-croidro`)                   | Enabled     | Public CSV export from the ID register                   | Unknown            |
| Cyprus EMS (`cy-ems`)                          | Placeholder | Temporary EMS page; no identifier list found yet         | Unknown            |
| Danish Road Traffic Authority (`dk-fstyr`)     | Enabled     | Public HTML table from the IDRO registration page        | Unknown            |
| BDEW (`de-bdew`)                               | Enabled     | Public paginated JSON endpoint                           | Unknown            |
| Traficom (`fi-traficom`)                       | Enabled     | Public HTML table from the AFIR ID page                  | Unknown            |
| Hellenic IDRO (`gr-electrokinisi`)             | Enabled     | Public HTML table from the ID-register page              | Unknown            |
| Hungarian IDRO (`hu-idro`)                     | Enabled     | Public HTML list from the members page                   | Unknown            |
| TII IDRO Public Register (`ie-tii`)            | Enabled     | Public PDF register                                      | Unknown            |
| LVC IDRO Register (`lv-lvceli`)                | Enabled     | Public Drupal JSON page with embedded HTML table         | Unknown            |
| Via Lietuva (`lt-vialietuva`)                  | Enabled     | Public OCPI locations endpoint for CPO identifiers       | CC BY 4.0 / ODC-BY |
| EIPA (`pl-eipa`)                               | Enabled     | Public CSV export from the registered entities list      | Unknown            |
| MOBI.E IDACS (`pt-mobie`)                      | Enabled     | Public PDF register                                      | Unknown            |
| RIPREE (`es-ripree`)                           | Placeholder | Public export pages found, no IDRO party list identified | Unknown            |
| Slovenian NAP IDRO (`si-nap`)                  | Enabled     | Public XLSX national repository from NAP                 | Unknown            |
| SuisseEnergie (`ch-suisseenergie`)             | Enabled     | Public Gatsby page-data JSON endpoint                    | Unknown            |
| Swedish Energy Agency (`se-energimyndigheten`) | Enabled     | Public XLSX registers for CPO and EMSP identifiers       | Unknown            |
| EV Roam (`gb-evroam`)                          | Placeholder | Not implemented                                          | Unknown            |

## EAFO IDRR Coverage Reference

The EAFO IDRR directory currently lists these national or regional IDRO entries. This table is a coverage planning reference only; records are published only when a source connector preserves provenance from the originating registry.

| IDRR entry               | Project status     |
| ------------------------ | ------------------ |
| Austria                  | Supported          |
| Benelux                  | Supported          |
| Croatia                  | Supported          |
| Cyprus                   | Placeholder source |
| Denmark                  | Supported          |
| Finland                  | Supported          |
| France                   | Supported          |
| Germany                  | Supported          |
| Greece                   | Supported          |
| Hungary                  | Supported          |
| Ireland                  | Supported          |
| Latvia                   | Supported          |
| Lithuania                | Supported          |
| Poland                   | Supported          |
| Portugal                 | Supported          |
| Slovenia                 | Supported          |
| Spain                    | Placeholder source |
| Sweden                   | Supported          |
| Switzerland (Non-EU)     | Supported          |
| United Kingdom (Non-EU)  | Placeholder source |
| Bulgaria (coming soon)   | Awaiting IDRR data |
| Czechia (coming soon)    | Awaiting IDRR data |
| Estonia (coming soon)    | Awaiting IDRR data |
| Italy (coming soon)      | Awaiting IDRR data |
| Luxembourg (coming soon) | Awaiting IDRR data |
| Malta (coming soon)      | Awaiting IDRR data |
| Romania (coming soon)    | Awaiting IDRR data |
| Slovakia (coming soon)   | Awaiting IDRR data |

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

## Quick Start

```bash
bun install
bun run registry update --source at-ladestellen
bun run registry update --source benelux-idro
bun run registry update --source dk-fstyr
bun run registry update --source de-bdew
bun run registry update --source fi-traficom
bun run registry update --source fr-afirev
bun run registry update --source gr-electrokinisi
bun run registry update --source hu-idro
bun run registry update --source hr-croidro
bun run registry update --source ie-tii
bun run registry update --source lv-lvceli
bun run registry update --source lt-vialietuva
bun run registry update --source pl-eipa
bun run registry update --source pt-mobie
bun run registry update --source si-nap
bun run registry update --source ch-suisseenergie
bun run registry update --source se-energimyndigheten
bun run registry:non-idrr
bun run check
```

## CLI

```bash
bun run registry fetch
bun run registry fetch --source at-ladestellen
bun run registry fetch --source benelux-idro
bun run registry fetch --source dk-fstyr
bun run registry fetch --source de-bdew
bun run registry fetch --source fi-traficom
bun run registry fetch --source fr-afirev
bun run registry fetch --source gr-electrokinisi
bun run registry fetch --source hu-idro
bun run registry fetch --source hr-croidro
bun run registry fetch --source ie-tii
bun run registry fetch --source lv-lvceli
bun run registry fetch --source lt-vialietuva
bun run registry fetch --source pl-eipa
bun run registry fetch --source pt-mobie
bun run registry fetch --source si-nap
bun run registry fetch --source ch-suisseenergie
bun run registry fetch --source se-energimyndigheten
bun run registry build
bun run registry validate
bun run registry update
bun run registry non-idrr:reports
bun run registry diff
bun run registry stats
```

## Data Model

Each record contains a stable key, normalized `countryCode`, `partyId`, `eMobilityId`, role, status, organization data, source provenance, and source-specific metadata. Roles are kept as separate records when a source publishes a combined type.

Complementary non-IDRR data uses `IdentifierObservation` records instead of
official registry records. Observations explicitly preserve identifier scheme,
authority level, observation type, evidence URL, confidence score, and reasons.
OCPI party IDs, EVSE prefixes, hub IDs, national IDs, and eMI3 IDs are not merged
without explicit alias evidence.

## Provenance And Freshness

Every normalized value keeps the originating registry ID, source URL, exact source value, retrieval timestamp, and raw snapshot checksum. A failed source does not erase previously generated records; it is marked stale in `sources.json`.

## License Warning

The project source code uses Apache License 2.0. Aggregated registry data keeps source provenance and may be subject to upstream rights. Unknown licensing is displayed explicitly and must not be treated as open-data permission.

## Contributing

Read `docs/adding-a-source.md` before adding a connector. Use official APIs or downloads before HTML parsing, keep connector-specific logic isolated, and add deterministic fixture tests.

## Roadmap

- Milestone 2: non-IDRR source investigation, EVSEID.eu portal matrix, public
  infrastructure observations, conflict reporting, historical observations.
- Milestone 3: GitHub Pages search, country-specific static JSON, lookup pages, health dashboard.
- Milestone 4: broader IDRO coverage guided by the EAFO IDRR, source owner workflow, signed releases, public change feed.
