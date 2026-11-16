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

Errors use the standard error body:

- `422 INVALID_COUNTRY_CODE`: the code is not two letters.
- `404 COUNTRY_NOT_FOUND`: no source covers the country and no identifier
  carries it.

Sources also expose `registry.supportedRoles`, the roles a register declares it
publishes. It is `null` until the first import after migration `0005`.
