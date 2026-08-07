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

A row can be kept out of the datasets for three different reasons, and
`data/registry-invalid.json` reports all three:

- `records`: rows a connector normalized into a record whose identifier then
  failed the rule, with their reason codes (`INVALID_COUNTRY`,
  `INVALID_PARTY_ID`).
- `rows`: raw upstream values a connector could not split into a country code
  and a party ID at all, so they never became a record. Each carries its
  `registryId`, the connector issue `code`, the rejected `sourceValue`, and the
  message.
- `outOfJurisdiction`: well-formed identifiers a register publishes for a
  country it does not administer. Each carries its `registryId`, `code`,
  `sourceValue`, the `countryCode` it belongs to, and the message, so the
  entries can be filtered by register or by country and taken back to the
  registries concerned.

The first two mean different things: a rejected row is upstream data the
pipeline could not read, an invalid record is data it read and then refused.
Both are only reported for sources whose run was actually ingested -- a source
that fails its safety thresholds republishes its previous records, so its
discarded rows would describe nothing. The same value published twice in one run
is one problem, so it is recorded once.

The third is neither a defect nor a publication, but a finding to raise with the
register that published it. A source covers its authority's jurisdictions, which
the optional `registry.jurisdictions` may narrow when the register serves less
than the authority does. A connector publishes no identifier outside that
coverage, and reports the value as
`<CONNECTOR>_OUT_OF_JURISDICTION_IDENTIFIER`. Nothing is wrong with the value
itself, so counting it as unreadable would send a maintainer looking for a
parser bug that does not exist -- and would bury the values that genuinely are
unreadable. A prefix naming no country at all, such as `ZZ`, is a rejected row
instead: it is unreadable, not foreign. A register that legitimately covers
several countries, such as EV Roam for `GB` and `IE`, declares them and keeps
publishing them; the appointed-registry policy is what decides whether those
records are authoritative.

`outOfJurisdictionByRegistry` says who to tell; `outOfJurisdictionByCountry`
says whose identifiers they are. `data/reports/out-of-jurisdiction.json` turns
the same findings into an actionable list, grouped by the register to contact --
see `docs/operations.md`.

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
`invalidRecordsByRegistry`, `totalRejectedRows`, `rejectedRowsByRegistry`,
`totalOutOfJurisdictionRows`, `outOfJurisdictionByRegistry`,
`outOfJurisdictionByCountry`)
describe only what the **current** run detected, so a corrected identifier stops
being reported as a live problem while staying in the history. An entry whose
`lastDetectedAt` is older than `generatedAt` is one the sources no longer
publish.

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
data and API responses still carry a derived `official` field, which is exactly
`authority.level === "AUTHORITATIVE"` and is never the source of truth. A null
`machineReadableUrl` means no stable machine-readable publication was found, not
that the registry is absent.

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
