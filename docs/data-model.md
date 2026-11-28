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
`outOfJurisdictionByCountry` count the current entries of the `outOfJurisdiction`
bucket, which no build adds to: they stay at zero and do not count
cross-register listings.

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
5. Absence from the issuing register is not represented as invalidity: no field
   says "not found", and the listing stays published.
6. A stale, unavailable, unsupported, or failed issuing source changes nothing
   about the listings other registers publish. A failed source republishes its
   own previous records; another register's observation is never removed or
   flagged because of it.

Whether the issuing register confirms an identifier is a separate fact, derived
from these records by the classification rules of #49; it is not stored on the
observation.

### Backward Compatibility

- `data/registry.json` and `data/registry.csv` gain rows: the cross-register
  listings that connectors used to refuse, for example `NL*TNM` in `pl-eipa`,
  `DK*MON` in `se-energimyndigheten`, `SE*VGC` in `es-ripree`, and the Irish
  entries of EV Roam (`gb-evroam` now covers `GB` only, so its `IE` entries are
  listings of identifiers Ireland issues).
- A consumer that filters by `countryCode` now also sees the listings other
  registers publish for that country. To keep only assignments, filter on
  `source.official` or on `source.observation.kind === "ASSIGNMENT"`.
- Records published before the block existed carry no `source.observation`.
  Derive it from the source's jurisdictions in `data/sources.json`: an
  `ASSIGNMENT` when they include the record's `countryCode`, a
  `CROSS_REGISTER_LISTING` otherwise.
- `outOfJurisdiction` in `data/registry-invalid.json` no longer grows; its
  existing entries stay.
- `data/reports/out-of-jurisdiction.json` keeps its shape but now lists the
  published cross-register listings, grouped by the register that lists them
  (see `docs/operations.md`).

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
