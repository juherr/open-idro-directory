# Data Model

The normalized record key is:

```text
registryId + ":" + countryCode + ":" + partyId + ":" + role
```

`countryCode` is uppercase ISO 3166-1 alpha-2. `partyId` is uppercased for AFIREV because its public prefixes are alphanumeric uppercase IDs. `eMobilityId` is `countryCode + partyId` without separators.

Organizations are not used as identifiers. Similar names are not merged. Source-specific fields are preserved in `metadata`.

## Identifier Validity

A published record must carry a valid eMI3 identifier:

- `countryCode` matches `^[A-Z]{2}$`;
- `partyId` matches `^[A-Z0-9]{3}$` -- exactly three characters, as assigned by
  eMI3 and ISO 15118;
- `eMobilityId` matches `^[A-Z]{2}[A-Z0-9]{3}$`.

These patterns live in `src/domain/emi3-identifier.ts` and are the single source
of truth for the zod schemas, the record validator, and the generated JSON
Schemas.

A row can be kept out of the datasets for two reasons, and
`data/registry-invalid.json` reports both:

- `records`: rows a connector normalized into a record whose identifier then
  failed the rule, with their reason codes (`INVALID_COUNTRY`,
  `INVALID_PARTY_ID`).
- `rows`: raw upstream values a connector could not split into a country code
  and a party ID at all, so they never became a record. Each carries its
  `registryId`, the connector issue `code`, the rejected `sourceValue`, and the
  message.

They mean different things: a rejected row is upstream data the pipeline could
not read, an invalid record is data it read and then refused. Both are only
reported for sources whose run was actually ingested -- a source that fails its
safety thresholds republishes its previous records, so its discarded rows would
describe nothing. The same value published twice in one run is one problem, so
it is recorded once. A prefix naming no country at all, such as `ZZ`, is a
rejected row: it is unreadable, not foreign.

A well-formed identifier of a country the register does not cover is not kept
out: it is published as a cross-register listing (see
[Issuing Country And Observing Register](#issuing-country-and-observing-register)).
The file keeps a third bucket, `outOfJurisdiction`, for the entries earlier
builds recorded when such identifiers were refused. No build adds to it any
more; its entries keep their `registryId`, `code`, `sourceValue`,
`countryCode`, message, and history fields, so they stay readable.

### History And Corrections

The file is **append-only**. An identifier a source corrects or drops would
otherwise vanish without trace, so every entry stays and carries:

- `firstDetectedAt` and `lastDetectedAt`: the runs that first and last saw the
  problem in a source snapshot;
- `supersededBy`: the eMobility ID that replaced the rejected identifier
  upstream, or `null` when nothing did.

`supersededBy` is **written by hand** in `data/registry-invalid.json` and carried
over by every later build. Nothing derives it. The replacement is an upstream
re-assignment rather than a truncation, so it cannot be computed from the
rejected identifier: two different rejected values may well map to the same
corrected one. Matching on organisation names is not an option either, since
organisations are not identifiers. A value that is not a valid eMobility ID
fails the build.

Editorial note: describe these entries by identifier and registry, as the data
does. Do not single out a registry operator as having published bad data in
prose -- the goal is a correct directory, not public blame.

Excluded entries never appear in `data/registry.*`. The counters in
`data/stats.json` (`totalInvalidRecords`, `invalidRecordsByReason`,
`invalidRecordsByRegistry`, `totalRejectedRows`, `rejectedRowsByRegistry`)
describe only what the **current** run detected, so a corrected identifier stops
being reported as a live problem while staying in the history. An entry whose
`lastDetectedAt` is older than `generatedAt` is one the sources no longer
publish. `totalOutOfJurisdictionRows`, `outOfJurisdictionByRegistry`, and
`outOfJurisdictionByCountry` count the cross-register listings among the
published records, once per register and identifier, as
`data/reports/out-of-jurisdiction.json` lists them. They do not read the
`outOfJurisdiction` bucket, which no build adds to.

The rule applies to the official registry pipeline only. Complementary
observations use other identifier schemes with their own length rules.

## Authority, Registry, And Publication

A source descriptor separates three identities that were previously conflated in
one flat object:

- **Authority** (`config/authorities/<id>.yaml`): the appointed organisation. It
  carries `level`, `jurisdictions`, and its landing page. An authority is
  described once; every source it operates references it through `authorityId`,
  so the same organisation is never duplicated. A source may instead declare an
  inline `authority` when the organisation backs only that one source.
- **Registry** (`registry` in the source descriptor): the register the authority
  operates. It carries the register `url`, the `observationType` its entries
  represent, and `supportedRoles`. Its optional `jurisdictions` may only narrow
  the authority's scope, never widen it.
- **Publication** (`publication` in the source descriptor): the technical
  resource a connector consumes -- `connector`, `machineReadableUrl`,
  `refreshSchedule`, `enabled`, `verifiedAt`, and safety thresholds. Several
  publications may expose the same registry, so freshness belongs here.

`verifiedAt` records the date of the latest editorial verification; generated
source health metadata records the latest attempted and successful retrievals
independently.

Authoritativeness is expressed by `authority.level`, not by a boolean. Generated
data and API responses still carry a derived `official` field, which is true
exactly when `authority.level === "AUTHORITATIVE"` and the record is an
`ASSIGNMENT` (see below), and is never the source of truth. A null
`machineReadableUrl` means no stable machine-readable publication was found, not
that the registry is absent.

## Issuing Country And Observing Register

A record states two different facts, kept apart:

- the **issuing country** is the record's `countryCode`, read from the
  identifier's prefix. It names the country whose IDRO the identifier belongs
  to, whichever register published it;
- the **observing register** is `source.registryId`: the register the record was
  read from.

`source.observation` says how the two relate:

- `kind: ASSIGNMENT`: the register covers the issuing country (its
  `registry.jurisdictions`, or its authority's jurisdictions when the registry
  does not narrow them). `observingJurisdiction` is the record's `countryCode`.
- `kind: CROSS_REGISTER_LISTING`: the register lists another country's
  identifier. This neither makes the register the issuer nor says anything about
  the identifier's standing with its issuer. `observingJurisdiction` is the
  register's jurisdiction when it covers exactly one country, and `null` when it
  covers several: a Benelux register cannot say which of its countries observed
  the identifier.

`source.official` is true only for an `ASSIGNMENT` from an authoritative source.
A cross-register listing is always `official: false`, and the status policy
reports an `ACTIVE` listing as `UNKNOWN` (`metadata.statusPolicy`) when the
issuing country has official records: the observing register cannot speak for
the issuer. Neither value is a statement about the identifier's legal validity.

When a register stops publishing a listing, the record is dropped rather than
kept as a tombstone: a listing records an observation, not an assignment that
could have been withdrawn.

### Reference Scenarios

The scenarios of issue #91, and how each is represented:

1. `PL*XYZ` assigned and listed by the Polish IDRO: a `pl-eipa` record with
   `countryCode: PL`, `kind: ASSIGNMENT`, `observingJurisdiction: PL`,
   `official: true`.
2. `NL*TNM` listed in Poland: a `pl-eipa` record with `countryCode: NL`,
   `kind: CROSS_REGISTER_LISTING`, `observingJurisdiction: PL`,
   `official: false`. The Netherlands stays the issuing country; the Benelux
   register's own `NL*TNM` record, if it publishes one, is a separate record.
3. `DK*MON` observed in Sweden through OCPI: a `se-energimyndigheten` record
   with `countryCode: DK`, `kind: CROSS_REGISTER_LISTING`,
   `observingJurisdiction: SE`, `official: false`. Sweden is the observing
   register, not the issuer.
4. A `PL*...` identifier another public source lists while the Polish register
   does not: that source's listing record exists on its own. Nothing is added
   to or removed from the `pl-eipa` records, and the listing is not refused.
5. Absence from the issuing register is not represented as invalidity: the
   listing stays published, and its `issuing.confirmation` says `NOT_FOUND`
   (not found in the issuing register) only when every issuing register is
   current.
6. A stale, unavailable, unsupported, or failed issuing source changes nothing
   about the listings other registers publish. A failed source republishes its
   own previous records; another register's observation is never removed or
   flagged because of it.

Whether the issuing register confirms an identifier is a separate fact, derived
from these records by the classification rules of #49; it is not stored on the
observation but in the record's `issuing` block (see
[Issuing Confirmation](#issuing-confirmation)).

### Backward Compatibility

- `data/registry.json` and `data/registry.csv` gain rows: the cross-register
  listings that connectors used to refuse, for example `NL*TNM` in `pl-eipa`,
  `DK*MON` in `se-energimyndigheten`, `SE*VGC` in `es-ripree`, and the Irish
  entries of EV Roam (`gb-evroam` now covers `GB` only, so its `IE` entries are
  listings of identifiers Ireland issues).
- A consumer that filters by `countryCode` now also sees the listings other
  registers publish for that country. The two filters that remove them are not
  equivalent. `source.official` keeps only the assignments of authoritative
  sources: a non-authoritative source's record of a country it covers is an
  `ASSIGNMENT` with `official: false`, and this filter drops it.
  `source.observation.kind === "ASSIGNMENT"` keeps every assignment, whatever
  the source's authority, but needs the derivation below for records that
  carry no block.
- Records published before the block existed carry no `source.observation`.
  Derive it from the source's jurisdictions in `data/sources.json`: an
  `ASSIGNMENT` when they include the record's `countryCode`, a
  `CROSS_REGISTER_LISTING` otherwise.
- A cross-register listing a register no longer publishes is dropped from the
  build, not kept as an `INACTIVE` tombstone with `metadata.inactiveReason:
missing-from-official-source`. This also applies to listings an earlier build
  had already tombstoned: the first build with this model removes them. In
  practice this drops the few `IE` entries of `gb-evroam` that EV Roam had
  stopped publishing and that were kept as `INACTIVE` records; their keys no
  longer appear in `data/registry.json`.
- `outOfJurisdiction` in `data/registry-invalid.json` no longer grows; its
  existing entries stay.
- `data/reports/out-of-jurisdiction.json` keeps its shape but now lists the
  published cross-register listings, grouped by the register that lists them
  (see `docs/operations.md`).
- The out-of-jurisdiction counters of `data/stats.json` keep their names but
  now count those listings, not the `outOfJurisdiction` bucket.

## Issuing Confirmation

Every published record carries an `issuing` block saying what the registers
that issue its identifier report about it:

```json
"issuing": { "country": "DK", "confirmation": "NOT_FOUND", "confirmedBy": [] }
```

- `country` is the identifier's own country, the record's `countryCode`.
- `confirmation` is one of the six states below.
- `confirmedBy` lists, sorted and once each, the ids of the issuing registers
  that confirm the identifier. It is empty unless `confirmation` is
  `CONFIRMED`.

The block is computed per identifier and role (`CC:PID:ROLE`) over all the
records of the build, so every record of the same identifier and role carries
the same block, whichever register published it. `DK*MON` listed by
`se-energimyndigheten` carries the answer of `dk-fstyr`, not of Sweden.

### Issuing Registers

The issuing registers of `CC:PID:ROLE` are the authoritative sources, enabled
or not, whose jurisdictions (the registry's, or the authority's when the
registry does not narrow them) include `CC` and whose `registry.supportedRoles`
include `ROLE`. A register limited to some roles is read through
`supportedRoles` alone: `at-ladestellen` publishes CPOs only, so it is no
issuing register of an Austrian EMSP identifier.

### States And Precedence

The first rule that matches gives the state:

1. `CONFIRMED`: an issuing register holds an `ASSIGNMENT` record of the
   identifier and role that its latest retrieval still listed
   (`source.lastSeenAt` equals `source.retrievedAt`), whatever the record's
   `status` and whatever that register's health. Cross-register listings and
   tombstones of identifiers the register stopped listing never confirm.
2. `NO_ISSUING_SOURCE`: no authoritative source covers the country.
3. `UNSUPPORTED_ROLE`: sources cover the country, but none publishes the
   role.
4. `SOURCE_UNAVAILABLE`: an issuing register is disabled, failed, or of
   unknown health. It outranks a stale one.
5. `SOURCE_STALE`: an issuing register is stale.
6. `NOT_FOUND`: every issuing register is current and none lists the
   identifier.

`NOT_FOUND` reads "not found in the issuing register". It never means the
identifier is invalid: the registers may lag, and the record stays published
whatever its state. None of the states is a statement about legal validity.

### Source Health

The health of an issuing register is read from the build's result for that
source:

- never retrieved (no `lastSuccessfulRetrieval`): unavailable;
- not stale: current;
- stale, and its last successful retrieval is not the latest attempt: the fetch
  or the build failed, so unavailable;
- stale otherwise: the register answered, but the run reported an error, so
  stale. A source is stale as soon as its run has any error, so a parse,
  normalisation or safety-threshold error on a register that answered all give
  `SOURCE_STALE`.

A source a partial update (`directory update --source <id>`) does not rebuild
keeps the health published in `data/sources.json`, so the update classifies its
identifiers as the last full build did. Updating `se-energimyndigheten` alone
gives `DK*MON` the same block as a full build. A source with no published
health is unavailable, not current.

### CSV And Statistics

`data/registry.csv` carries the block and the observation kind in three
columns appended after `retrievedAt`:

- `issuingCountry`: `issuing.country`;
- `issuingConfirmation`: `issuing.confirmation`;
- `observationKind`: `source.observation.kind`, derived from the source's
  jurisdictions for a record that carries no observation block (see
  [Backward Compatibility](#backward-compatibility)), and empty for a record of
  a register no source describes.

`DK*MON` listed by `se-energimyndigheten` reads `DK`, `CONFIRMED`,
`CROSS_REGISTER_LISTING`. `confirmedBy` stays in the JSON exports only.

`data/stats.json` counts the records per state in
`recordsByIssuingConfirmation`, one per record like `recordsByStatus`, so an
identifier listed by two registers counts twice. A record without an `issuing`
block is not counted, and a state no record carries has no key.

### Compatibility

- `issuing` is optional in `schemas/registry.schema.json`. Records committed
  before it existed carry none, and every record gains it at the next scheduled
  run.
- The CSV columns are appended after the existing ones, so a consumer that
  reads columns by position keeps working. Their header names are snake_case,
  unlike the camelCase columns before them. The columns and
  `recordsByIssuingConfirmation` appear with the next scheduled run; the
  issuing cells stay empty for any record that carries no `issuing` block.
- The block is derived again on every build from every source. Its arrival or a
  change of state is not a record change: the safety thresholds and the change
  report leave it out of their comparisons, and a build drops the published
  block before it derives the new one.

## Discrepancy Report

`data/reports/discrepancies.json` lists what the issuing registers and the
other sources disagree on; how each finding is derived is in
`docs/data-consolidation.md`. Its shape:

```json
{
  "generatedAt": "2026-06-15T00:00:00.000Z",
  "summary": {
    "totalFindings": 1,
    "byCategory": {
      "NOT_FOUND_IN_ISSUING_REGISTER": 1,
      "CONFLICTING_ROLE": 0,
      "REMOVED_FROM_ISSUING_REGISTER": 0,
      "ADDED_TO_ISSUING_REGISTER": 0,
      "CONFLICTING_NAME": 0,
      "CONFLICTING_STATUS": 0,
      "ISSUING_REGISTER_UNVERIFIABLE": 0,
      "OUTSIDE_ISSUING_REGISTER_SCOPE": 0,
      "DUPLICATE_IDENTIFIER": 0,
      "MALFORMED_IDENTIFIER": 0,
      "SOURCE_STALE": 0,
      "SOURCE_UNAVAILABLE": 0
    },
    "bySeverity": { "high": 1, "medium": 0, "low": 0, "info": 0 }
  },
  "countries": [
    {
      "countryCode": "DK",
      "issuingRegistryIds": ["dk-fstyr"],
      "pairs": [
        {
          "issuingRegistryId": "dk-fstyr",
          "observedRegistryId": "se-energimyndigheten",
          "findings": [
            {
              "category": "NOT_FOUND_IN_ISSUING_REGISTER",
              "severity": "high",
              "confidence": "high",
              "countryCode": "DK",
              "issuingRegistryId": "dk-fstyr",
              "observedRegistryId": "se-energimyndigheten",
              "identifier": {
                "countryCode": "DK",
                "partyId": "MON",
                "role": "CPO",
                "eMobilityId": "DKMON"
              },
              "issuingConfirmation": "NOT_FOUND",
              "summary": "DKMON (CPO) is listed by se-energimyndigheten and not found in the issuing register dk-fstyr.",
              "evidence": [
                {
                  "recordKey": "se-energimyndigheten:DK:MON:CPO",
                  "registryId": "se-energimyndigheten",
                  "retrievedAt": "2026-06-15T00:00:00.000Z",
                  "lastSeenAt": "2026-06-15T00:00:00.000Z",
                  "healthState": "CURRENT"
                },
                {
                  "recordKey": null,
                  "registryId": "dk-fstyr",
                  "retrievedAt": "2026-06-15T00:00:00.000Z",
                  "lastSeenAt": null,
                  "healthState": "CURRENT"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

- `summary.byCategory` and `summary.bySeverity` list every category and
  severity, zero counts included, in a fixed order.
- `countryCode` is `null` for a finding about a source that covers several
  countries (a duplicate or an unreadable value, say), and `issuingRegistryId`
  is `null` when no issuing register is involved.
- `identifier` and `issuingConfirmation` are `null` for source-level findings.
  `reason` is present only on the categories that refine their cause (for
  example `SOURCE_STALE` or `SOURCE_UNAVAILABLE` on an unverifiable finding).
- Every finding has at least one `evidence` entry: a record (`recordKey`) or a
  source-level observation (`recordKey: null`), with its `retrievedAt`. The
  optional fields carry what the category compares: role, status, organisation
  name, health state, record count, detection dates, or the connector's
  duplicate warning code and message.

The schema is `schemas/discrepancies.schema.json`. Compatibility: the report is
a new file; no existing dataset, schema or API response changes.

## Source Provenance And Reuse

The `reuse.status` field distinguishes the legal mechanism that applies:

- `licensed`: an explicit licence is published in `reuse.licence`;
- `statutory`: reuse relies on legislation recorded in `reuse.legalBasis`;
- `permission-granted`: the source owner granted permission outside a published licence;
- `restricted`: known terms restrict reuse;
- `unspecified`: no explicit reuse terms have been identified.

Public availability must not be represented as permission to reuse. A statutory
basis must not be represented as a Creative Commons or Open Data Commons licence.

## Complementary Observations

Non-IDRR sources use a separate `IdentifierObservation` model. Observations do
not overwrite official `NormalizedRegistryRecord` entries and are not emitted in
`data/registry.*`.

Observation records explicitly store:

- `scheme`: eMI3 operator/provider ID, OCPI party ID, OCN party ID, hub party ID,
  national internal ID, EVSE prefix, or unknown;
- `authorityLevel`: authoritative, supranational directory, secondary,
  self-asserted, or unverified;
- `observationType`: official assignment, directory entry, legacy assignment,
  network registration, infrastructure observation, self-declaration, or
  community observation;
- confidence score and reasons.

OCPI `country_code + party_id`, eMI3 IDs, and EVSE prefixes are separate schemes.
They must not be merged unless an explicit equivalence source provides evidence.
