# Source Limitations

Open IDRO Directory aggregates public upstream registries with different formats,
semantics, and publication practices. The generated dataset preserves source
provenance, but it is not an official copy of any national register.

## Cross-Source Limitations

Most upstream sources do not publish explicit reuse terms. Their `reuse.status`
is therefore `unspecified`; public access does not imply permission to
redistribute. Spain uses a statutory reuse basis, while Traficom, TII, and Via
Lietuva publish explicit licences.

Many sources publish identifiers without a lifecycle status. Connectors mark
those current entries as `ACTIVE`. When an official source no longer publishes a
previously observed identifier, the build keeps the record as `INACTIVE` with
`metadata.inactiveReason` set to `missing-from-official-source`; disappearance
does not prove revocation.

A failed fetch, parse, or safety check does not erase the last successful data.
The build retains the previous records and marks the source as stale in
`data/sources.json`.

The `machineReadableUrl` field identifies one primary structured resource. It
does not enumerate every request, role-specific query, page, or workbook used by
connectors that aggregate multiple resources.

## Source Matrix

| Source                 | Upstream format               | Published coverage                                                    | Main limitation                                                                                                                                                                                        |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `at-ladestellen`       | Public JSON API               | Austrian CPO identifiers                                              | The public application supplies an API key from its client bundle. The connector depends on that public access pattern remaining available.                                                            |
| `benelux-idro`         | CSV export                    | CPO and EMSP identifiers for Belgium, the Netherlands, and Luxembourg | The export does not provide a normalized lifecycle status, so current rows are `ACTIVE`.                                                                                                               |
| `ch-suisseenergie`     | HTML page with Astro island   | Swiss CPO and EMP identifiers                                         | The connector reads the register from the page's embedded Astro island payload, so a redesign of the page can break it. It deduplicates locale copies by identifier.                                   |
| `cy-ems`               | HTML page                     | No published identifiers                                              | The source is disabled. No public machine-readable CPO or MSP identifier register has been identified.                                                                                                 |
| `de-bdew`              | Paginated JSON API            | Active German CPO and EMSP identifiers                                | The connector performs separate role queries and pagination. `machineReadableUrl` exposes only the shared endpoint.                                                                                    |
| `dk-fstyr`             | HTML table                    | Danish CPO and MSP identifiers                                        | The connector parses page markup because no public registry export has been identified. Markup changes can break extraction.                                                                           |
| `es-ripree`            | XML export                    | Spanish CPO and EMSP identifiers                                      | Unknown company types are skipped. Reuse relies on Spanish Law 37/2007 rather than an explicit open-data licence.                                                                                      |
| `fi-traficom`          | HTML table                    | Finnish identifiers with explicit CPO or MSP roles                    | Traficom is the IDRO and registry source. Fintraffic separately operates the National Access Point for charging-infrastructure data. Other observed IDs are skipped when their roles are not explicit. |
| `fr-afirev`            | Public JSON API               | French CPO and EMSP prefixes                                          | AFIREV `SUSPENDED` maps to `UNKNOWN`. A `BOTH` type creates separate CPO and EMSP records.                                                                                                             |
| `gb-evroam`            | Public JSON API               | GB identifiers and cross-register IE identifiers                      | GB entries are authoritative EV Roam assignments. IE entries remain non-official `UNKNOWN` observations because TII is the Irish registrar.                                                            |
| `gr-electrokinisi`     | HTML table                    | Greek CPO and EMSP identifiers                                        | No structured export has been identified. The connector depends on server-rendered table markup.                                                                                                       |
| `hr-croidro`           | CSV export                    | Croatian CPO and MSP identifiers                                      | Current export rows are normalized as `ACTIVE` because the source does not expose a lifecycle status.                                                                                                  |
| `hu-idro`              | HTML list                     | Hungarian CPO and MSP identifiers                                     | The connector skips entries whose role label is unknown and depends on server-rendered markup.                                                                                                         |
| `ie-tii`               | PDF register                  | Irish CPO and eMSP identifiers                                        | TII is the appointed IDRO and publishes the authoritative register under CC BY 4.0. Extraction requires Poppler `pdftotext`; PDF layout or filename changes can break parsing or retrieval.            |
| `lt-vialietuva`        | OCPI locations API            | Lithuanian CPO identifiers observed in charging locations             | The connector derives CPO party IDs from location records and does not provide an eMSP register. Multiple locations collapse into one CPO record.                                                      |
| `lv-lvceli`            | JSON response containing HTML | Latvian CPO and EMSP identifiers                                      | The API wraps the register as an HTML table inside JSON. Table markup changes can break extraction.                                                                                                    |
| `pl-eipa`              | Semicolon-delimited CSV       | Polish CPO and EMSP identifiers                                       | Current export rows are normalized as `ACTIVE` because the source does not expose a lifecycle status.                                                                                                  |
| `pt-mobie`             | PDF register                  | Portuguese party identifiers                                          | The connector extracts table text from a PDF. PDF layout or filename changes can break parsing or retrieval.                                                                                           |
| `se-energimyndigheten` | Two XLSX workbooks            | Swedish CPO and EMSP identifiers                                      | The connector combines separate CPO and EMSP workbooks. `machineReadableUrl` points only to the primary CPO workbook; each record retains its actual workbook URL.                                     |
| `si-nap`               | XLSX download                 | Slovenian CPO and MSP identifiers                                     | The repository download endpoint and workbook structure must remain stable. Current rows are normalized as `ACTIVE`.                                                                                   |

## Status Normalization

AFIREV is the only current connector that maps a detailed upstream lifecycle
status. It uses the following mapping:

| AFIREV status | Normalized status |
| ------------- | ----------------- |
| `ACTIVE`      | `ACTIVE`          |
| `INACTIVE`    | `INACTIVE`        |
| `SUSPENDED`   | `UNKNOWN`         |
| Unknown value | `UNKNOWN`         |

The original AFIREV value remains available in `metadata.afirevStatus`.

## Role Expansion And Deduplication

AFIREV type `BOTH` creates separate CPO and EMSP records with the same party
identifier. SuisseEnergie removes locale duplicates, Via Lietuva collapses
multiple locations for the same CPO, and the Swedish connector combines two
role-specific workbooks.

The registry does not merge organizations by name. Overlapping claims from
different sources retain separate source records and provenance.

## Operational Dependencies

The Irish and Portuguese connectors require Poppler `pdftotext`. Binary and
generated resource URLs, including PDF, XLSX, and framework-generated data
paths, can change without a redirect even when the human-facing registry page
remains stable. Connectors that read data embedded in a page share the same
exposure to upstream redesigns.

Safety thresholds stop publication when a source produces unexpectedly large
deletions, changes, or parse-error ratios. Operators must investigate those
failures rather than lower thresholds to accept an unexplained upstream change.
