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

Records that fail the rule are excluded from `data/registry.*` and collected in
`data/registry-invalid.json` with their reason codes (`INVALID_COUNTRY`,
`INVALID_PARTY_ID`). `data/stats.json` reports them as counters
(`totalInvalidRecords`, `invalidRecordsByReason`, `invalidRecordsByRegistry`),
never as entries. The file is regenerated on every build and is normally empty;
a non-empty list signals an upstream or connector regression.

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
