# Global eMobility ID Registry

Global eMobility ID Registry aggregates, normalizes, validates, and publishes e-mobility identifiers from official national or regional IDRO registries.

> Global eMobility ID Registry is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.

The project uses the European Alternative Fuels Observatory's [Identification Registration Repository (IDRR)](https://alternative-fuels-observatory.ec.europa.eu/markets-and-policy/policy-insights/identification-registration-repository) as a reference for identifying relevant IDROs and planning broader source coverage. The IDRR is not treated as a substitute for provenance from each originating registry.

## Supported Sources

| Source                                     | Status      | Mechanism                                                | License |
| ------------------------------------------ | ----------- | -------------------------------------------------------- | ------- |
| Ladestellen.at (`at-ladestellen`)          | Enabled     | Public JSON endpoint used by Ladestellen.at's admin UI   | Unknown |
| AFIREV (`fr-afirev`)                       | Enabled     | Public JSON endpoint used by AFIREV's embedded directory | Unknown |
| Benelux IDRO (`benelux-idro`)              | Enabled     | Public CSV export from the ID register                   | Unknown |
| Croatian IDRO (`hr-croidro`)               | Enabled     | Public CSV export from the ID register                   | Unknown |
| Cyprus EMS (`cy-ems`)                      | Placeholder | Temporary EMS page; no identifier list found yet         | Unknown |
| Danish Road Traffic Authority (`dk-fstyr`) | Enabled     | Public HTML table from the IDRO registration page        | Unknown |
| BDEW (`de-bdew`)                           | Placeholder | Not implemented                                          | Unknown |
| EV Roam (`gb-evroam`)                      | Placeholder | Not implemented                                          | Unknown |

## EAFO IDRR Coverage Reference

The EAFO IDRR directory currently lists these national or regional IDRO entries. This table is a coverage planning reference only; records are published only when a source connector preserves provenance from the originating registry.

| IDRR entry               | Project status     |
| ------------------------ | ------------------ |
| Austria                  | Supported          |
| Benelux                  | Supported          |
| Croatia                  | Supported          |
| Cyprus                   | Placeholder source |
| Denmark                  | Supported          |
| Finland                  | Backlog            |
| France                   | Supported          |
| Germany                  | Placeholder source |
| Greece                   | Backlog            |
| Hungary                  | Backlog            |
| Ireland                  | Backlog            |
| Latvia                   | Backlog            |
| Lithuania                | Backlog            |
| Poland                   | Backlog            |
| Portugal                 | Backlog            |
| Slovenia                 | Backlog            |
| Spain                    | Backlog            |
| Sweden                   | Backlog            |
| Switzerland (Non-EU)     | Backlog            |
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

## Quick Start

```bash
bun install
bun run registry update --source at-ladestellen
bun run registry update --source benelux-idro
bun run registry update --source dk-fstyr
bun run registry update --source fr-afirev
bun run registry update --source hr-croidro
bun run check
```

## CLI

```bash
bun run registry fetch
bun run registry fetch --source at-ladestellen
bun run registry fetch --source benelux-idro
bun run registry fetch --source dk-fstyr
bun run registry fetch --source fr-afirev
bun run registry fetch --source hr-croidro
bun run registry build
bun run registry validate
bun run registry update
bun run registry diff
bun run registry stats
```

## Data Model

Each record contains a stable key, normalized `countryCode`, `partyId`, `eMobilityId`, role, status, organization data, source provenance, and source-specific metadata. Roles are kept as separate records when a source publishes a combined type.

## Provenance And Freshness

Every normalized value keeps the originating registry ID, source URL, exact source value, retrieval timestamp, and raw snapshot checksum. A failed source does not erase previously generated records; it is marked stale in `sources.json`.

## License Warning

The project source code uses Apache License 2.0. Aggregated registry data keeps source provenance and may be subject to upstream rights. Unknown licensing is displayed explicitly and must not be treated as open-data permission.

## Contributing

Read `docs/adding-a-source.md` before adding a connector. Use official APIs or downloads before HTML parsing, keep connector-specific logic isolated, and add deterministic fixture tests.

## Roadmap

- Milestone 2: BDEW XLSX, EV Roam, conflict reporting, historical observations.
- Milestone 3: GitHub Pages search, country-specific static JSON, lookup pages, health dashboard.
- Milestone 4: broader IDRO coverage guided by the EAFO IDRR, source owner workflow, signed releases, public change feed.
