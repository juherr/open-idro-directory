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
observation, with their retrieval timestamps. The report is deterministic: it
depends neither on the clock nor on the order of its inputs, only on the build's
records, the source descriptors, their health, the exclusion history, and the
duplicate warnings the connectors raised.

| Category                         | Severity                                    | Confidence                                             | Raised when                                                                                                                                                   |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_FOUND_IN_ISSUING_REGISTER`  | high                                        | high (medium when the observing source is not current) | another source lists the identifier and every issuing register is current and does not list it; one per issuing register that does not list it under any role |
| `CONFLICTING_ROLE`               | medium                                      | high (medium when the observing source is not current) | another source lists the identifier, and an issuing register that publishes the listed role lists it under another role                                       |
| `REMOVED_FROM_ISSUING_REGISTER`  | medium                                      | high                                                   | a current issuing register stopped listing an identifier it assigned                                                                                          |
| `ADDED_TO_ISSUING_REGISTER`      | info                                        | high                                                   | a current issuing register lists an identifier for the first time                                                                                             |
| `CONFLICTING_NAME`               | low                                         | medium                                                 | two sources publish the identifier under different organisation names                                                                                         |
| `CONFLICTING_STATUS`             | medium                                      | high                                                   | two sources publish the identifier with different statuses                                                                                                    |
| `ISSUING_REGISTER_UNVERIFIABLE`  | info                                        | low                                                    | the issuing register is stale or unavailable, so a listing or a removal cannot be checked                                                                     |
| `OUTSIDE_ISSUING_REGISTER_SCOPE` | info                                        | high                                                   | no issuing register is tracked for the country, or none publishes the role                                                                                    |
| `DUPLICATE_IDENTIFIER`           | low                                         | high                                                   | a source publishes the same identifier more than once                                                                                                         |
| `MALFORMED_IDENTIFIER`           | low                                         | high                                                   | a source publishes a value that does not read as an eMI3 identifier                                                                                           |
| `SOURCE_STALE`                   | medium (low for a non-authoritative source) | high                                                   | the source answered but its latest run was not ingested                                                                                                       |
| `SOURCE_UNAVAILABLE`             | medium (low for a non-authoritative source) | high                                                   | the source could not be retrieved, or was never retrieved                                                                                                     |

Conflicts compare the issuing register's record with every other source's;
without an issuing record, they compare the other sources with each other.
A removal is reported per issuing register: another issuing register that still
lists the identifier does not hide it, and the finding keeps the identifier's
`CONFIRMED` confirmation.

Rules that keep a temporary failure from reading as a discrepancy:

- An issuing register that is stale or unavailable never yields
  `NOT_FOUND_IN_ISSUING_REGISTER` or `REMOVED_FROM_ISSUING_REGISTER`, only
  `ISSUING_REGISTER_UNVERIFIABLE`, with the register's state as its `reason`,
  next to a `SOURCE_STALE` or `SOURCE_UNAVAILABLE` finding. Health is read as for
  the issuing confirmation (see the data model).
- A partial build (`--source <id>`) reports what a full build would: the sources
  it does not rebuild keep their published health, and their duplicate findings
  are read back from the previously published report. A source that failed and
  republishes its previous records keeps its previous duplicate findings too;
  a source ingested in the run reports only the duplicates its connector raised
  in that run. A disabled source, or one whose descriptor was removed, loses its
  duplicate findings with its records.

Two categories reach beyond the current retrieval:

- `MALFORMED_IDENTIFIER` takes every entry of the exclusion history
  (`data/registry-invalid.json`, records and rows alike), so an entry stays in
  the report after the source stopped publishing it, with the dates it was
  first and last detected.
- `ADDED_TO_ISSUING_REGISTER` flags every record of a current issuing register
  whose first retrieval is the current one; a stale or unavailable register's
  carried records are never added. On a register's first retrieval, that is
  every record it
  publishes.

The payload is described by `schemas/discrepancies.schema.json`.
