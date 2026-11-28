# Data Consolidation

The API separates source observations from consolidated party views.

A party is keyed by `countryCode + partyId`. It is a computed lookup entity, not a verified legal identity. Observations remain source-specific and preserve provenance.

Preferred organization name selection:

1. Prefer authoritative source data.
2. Prefer active observations.
3. Prefer the most recently retrieved observation.
4. Use source ID and role as deterministic tie-breakers.

Role and party status rules:

- `ACTIVE` wins when at least one official role observation is active.
- `REVOKED`, `INACTIVE`, and `RESERVED` require explicit source status.
- Absence from a source is not treated as revocation.
- Conflicts are exposed as diagnostics and do not silently overwrite data.

Alternative names, statuses, and source values remain available through observations.

## Discrepancy Reports

Every build, full or restricted to one source, writes
`data/reports/discrepancies.json` for the issuing authorities to review. It
compares what each issuing register publishes with what the other sources
observe. A finding says what was observed where; it is not a statement about an
identifier's standing, and it is never described as a fault until the issuing
authority confirms it.

Findings are grouped by country, then by pair of issuing register and observed
source. Each carries its evidence: the records involved, or the source-level
observation, with their retrieval timestamps; a record's or a register's
evidence also carries the effective health of its source (`healthState`). The report is deterministic: it
depends neither on the clock nor on the order of its inputs, only on the build's
records, the source descriptors, their health, the exclusion history, and the
duplicate warnings the connectors raised.

| Category                         | Severity                                    | Confidence                                             | Raised when                                                                                                                                                         |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_FOUND_IN_ISSUING_REGISTER`  | high                                        | high (medium when the observing source is not current) | another source lists the identifier and a current issuing register does not list it under any role; one per such register, whatever the other issuing registers say |
| `CONFLICTING_ROLE`               | medium                                      | high (medium when the observing source is not current) | another source lists the identifier, and an issuing register that publishes the listed role lists it under another role                                             |
| `REMOVED_FROM_ISSUING_REGISTER`  | medium                                      | high                                                   | a current issuing register stopped listing an identifier it assigned                                                                                                |
| `ADDED_TO_ISSUING_REGISTER`      | info                                        | high                                                   | a current issuing register lists an identifier for the first time                                                                                                   |
| `CONFLICTING_NAME`               | low                                         | medium (low when either source is not current)         | two sources publish the identifier under different organisation names                                                                                               |
| `CONFLICTING_STATUS`             | medium                                      | high (medium when either source is not current)        | two sources publish the identifier with different statuses                                                                                                          |
| `ISSUING_REGISTER_UNVERIFIABLE`  | info                                        | low                                                    | the issuing register is stale or unavailable, so a listing or a removal cannot be checked                                                                           |
| `OUTSIDE_ISSUING_REGISTER_SCOPE` | info                                        | high                                                   | no issuing register is tracked for the country, or none publishes the role                                                                                          |
| `DUPLICATE_IDENTIFIER`           | low                                         | high                                                   | a source publishes the same identifier more than once                                                                                                               |
| `MALFORMED_IDENTIFIER`           | low                                         | high                                                   | a source publishes a value that does not read as an eMI3 identifier                                                                                                 |
| `SOURCE_STALE`                   | medium (low for a non-authoritative source) | high                                                   | the source answered but its latest run was not ingested                                                                                                             |
| `SOURCE_UNAVAILABLE`             | medium (low for a non-authoritative source) | high                                                   | the source could not be retrieved, or was never retrieved                                                                                                           |

Conflicts compare each issuing register's record with every other issuing
register's, once per pair, and with every other source's; without an issuing
record, they compare the first source with the others.
A removal is reported per issuing register: another issuing register that still
lists the identifier does not hide it, and the finding keeps the identifier's
`CONFIRMED` confirmation. A listing is checked against each issuing register
that publishes its role on its own: a current one that does not list it yields
a not-found or a role conflict, a stale or unavailable one an unverifiable
finding, whatever the other issuing registers say. The identifier's
`issuingConfirmation` is carried as context and decides no finding.

Rules that keep a temporary failure from reading as a discrepancy:

- An issuing register that is stale or unavailable never yields
  `NOT_FOUND_IN_ISSUING_REGISTER` or `REMOVED_FROM_ISSUING_REGISTER`, only
  `ISSUING_REGISTER_UNVERIFIABLE`, with the register's state as its `reason`,
  next to a `SOURCE_STALE` or `SOURCE_UNAVAILABLE` finding. Health is read as for
  the issuing confirmation (see the data model).
- A partial build (`--source <id>`) reports what a full build would: the sources
  it does not rebuild keep their published health, and their duplicate and
  malformed findings are read back from the previously published report. A
  source that failed and republishes its previous records keeps its previous
  duplicate and malformed findings too; a source ingested in the run reports
  only the duplicates its connector raised and the malformed values it
  published in that run. A disabled source, or one whose descriptor was
  removed, loses these findings with its records. Without a previously
  published report, a source the run does not ingest has none until a run
  ingests it.

`MALFORMED_IDENTIFIER` reports the values a source still publishes, records and
rows alike, with the dates the exclusion history (`data/registry-invalid.json`)
first and last detected them. A value the source has since corrected or dropped
leaves the report; its entry stays in the history, which keeps every value ever
excluded.

`ADDED_TO_ISSUING_REGISTER` flags every record of a current issuing register
whose first retrieval is the current one; a stale or unavailable register's
carried records are never added. On a register's first retrieval, that is every
record it publishes.

The payload is described by `schemas/discrepancies.schema.json`.
