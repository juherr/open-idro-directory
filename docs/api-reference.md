# API Reference

Base path: `/api/v1`.

Disclaimer: Open IDRO Directory is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.

Responses use JSON:

```ts
type SuccessResponse<T> = {
  data: T;
  meta: { datasetReleaseId: string; generatedAt: string; schemaVersion: string };
};
```

Endpoints:

- `GET /api/v1`: root metadata, disclaimer, and links.
- `GET /api/v1/health`: service health and active dataset availability.
- `GET /api/v1/dataset`: active dataset release metadata.
- `GET /api/v1/parties`: party list with `country`, `partyId`, `emobilityId`, `role`, `status`, `authority`, `source`, `hasConflict`, `q`, `cursor`, `limit`.
- `GET /api/v1/parties/{countryCode}/{partyId}`: consolidated party detail.
- `GET /api/v1/parties/{countryCode}/{partyId}/observations`: source claims for a party.
- `GET /api/v1/parties/{countryCode}/{partyId}/conflicts`: diagnostics for a party.
- `GET /api/v1/sources`, `/sources/{sourceId}`, `/sources/{sourceId}/parties`, `/sources/{sourceId}/health`.
- `GET /api/v1/conflicts`: global conflict list.
- `GET /api/v1/stats`: aggregate counts.
- `GET /api/v1/countries/{countryCode}`: country summary, described below.
- `GET /api/v1/resolve/{emobilityId}`: resolves five-character party prefixes, accepting compact or separator forms such as `FR026`, `FR-026`, and `FR*026`.
- `GET /openapi.json` and `GET /docs`.

Pagination uses cursors only. Default `limit` is 50; maximum is 200.

## Issuing Country, Observations, and Issuing Confirmation

A party response keeps three facts apart, and none of them is a claim of legal
validity:

- `issuingCountry`: the identifier's prefix country, which issues it. A listing
  by another country's register never changes it.
- Observations (`/parties/{countryCode}/{partyId}/observations`): every source
  that published the identifier, with its provenance. Several national or
  complementary observations can coexist for one identifier. Each carries
  `observationKind` and `observingJurisdiction`:
  - `ASSIGNMENT`: the register covers the identifier's country;
  - `CROSS_REGISTER_LISTING`: the register lists another country's identifier.
    That neither makes it the issuer nor says anything about the identifier's
    standing with its issuer. Its `authorityLevel` is `SECONDARY`.
  - `observingJurisdiction` is the country of the register that published the
    observation, or `null` for a listing by a register covering several
    countries (Benelux).
- `roles[].issuing`: what the issuing country's register says about the
  identifier and role, evaluated independently of any listing elsewhere.
  `confirmation` is one of:
  - `CONFIRMED`: an issuing register lists it (`confirmedBy` names them);
  - `NOT_FOUND`: not found in the issuing register, every issuing register
    being current;
  - `SOURCE_STALE` / `SOURCE_UNAVAILABLE`: an issuing register is stale, or
    failed or disabled, so its silence proves nothing;
  - `UNSUPPORTED_ROLE`: the country's registers do not publish this role;
  - `NO_ISSUING_SOURCE`: no authoritative register covers the country.

  `confirmedBy` is empty unless the confirmation is `CONFIRMED`.

For example, `DK*MON` is published by the Danish register and by the Swedish
national dataset. `GET /api/v1/parties/DK/MON` answers `issuingCountry: "DK"`,
a `preferredName` taken from `dk-fstyr`, and for each role
`issuing: { confirmation: "CONFIRMED", confirmedBy: ["dk-fstyr"] }`. Its
observations list both the `dk-fstyr` `ASSIGNMENT` and the
`se-energimyndigheten` `CROSS_REGISTER_LISTING` with
`observingJurisdiction: "SE"`: the Swedish listing does not imply a Swedish
assignment.

`status`, `highestAuthorityLevel` and `hasConflict`, on the party and on each
role, are derived convenience values computed from the observations. They never
replace the observations or the issuing confirmation:

- `highestAuthorityLevel` is the strongest `authorityLevel` among the
  observations, so a party only listed outside its country is `SECONDARY`;
- `preferredName` comes from an assignment by the issuing register before any
  cross-register listing.

### Backward Compatibility (schema 1.4.0)

- The fields are additive: `issuingCountry`, `roles[].issuing`,
  `observationKind` and `observingJurisdiction` are new, and no field was
  removed or renamed. The OpenAPI document now describes the `Party`,
  `PartyRole`, `IssuingConfirmation` and `Observation` components.
- `observationKind` and `observingJurisdiction` are `null` until the first
  import after migration `0006`. `roles[].issuing.confirmation` and
  `roles[].issuing.confirmedBy` are `null` until the first import after it of a
  dataset carrying the issuing block. `null` means unknown, not unconfirmed.
- `highestAuthorityLevel` used to be `AUTHORITATIVE` for every party. It is now
  computed from the observations, so a party only listed outside its country is
  `SECONDARY`. This changes the results of the `?authority=` filter on
  `/parties` and the grouping by authority level in `/stats`.
- `preferredName` now prefers an assignment over a cross-register listing, so a
  party may change name where a listing was more recent than the assignment.

## Country Summary

`GET /api/v1/countries/{countryCode}` gathers what the directory knows about one
country. The code is an ISO 3166-1 alpha-2 code and is case-insensitive.

- `authorities`: every authority whose remit includes the country, each with the
  ids of its sources relevant to it. None is designated as _the_ IDRO: where
  several registers cover a country, as EV Roam and TII both do for Ireland,
  compare `sources[].countryObservations.byAuthorityLevel` to see which one is
  authoritative for it.
- `sources`: the sources whose registry declares the country, plus any source
  with identifiers in it. Each is the full `/sources/{sourceId}` payload with
  `countryObservations` (`total` and `byAuthorityLevel`) for that country.
- `coverage`: `status` is `PUBLISHED` when at least one identifier is known for
  the country, otherwise `NO_PUBLISHED_IDENTIFIERS`. `declaredRoles` is the union
  of the roles the declaring registers publish (`null` when not yet imported);
  `publishedRoles` counts the party roles actually present.
- `statistics`: `parties`, `partyRoles`, `observations`, `conflicts`, and
  `countsByStatus` for the country.
- `freshness`: the latest successful retrieval across the country's sources and
  the ids of those that are stale.
- `datasetTimestamp`: generation time of the active dataset.
- `links`: the summary itself and the country-filtered party and conflict lists.

A country with a known IDRO but no published register, such as Cyprus, returns
its authority and its disabled source with `NO_PUBLISHED_IDENTIFIERS`.

The same summary is rendered as HTML at `/countries/{code}/` (lowercase); see
`docs/api-architecture.md`.

Errors use the standard error body:

- `422 INVALID_COUNTRY_CODE`: the code is not two letters.
- `404 COUNTRY_NOT_FOUND`: no source covers the country and no identifier
  carries it.

Sources also expose `registry.supportedRoles`, the roles a register declares it
publishes. It is `null` until the first import after migration `0005`.
