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
- `GET /api/v1/resolve/{emobilityId}`: resolves normalized five-character party prefixes only.
- `GET /openapi.json` and `GET /docs`.

Pagination uses cursors only. Default `limit` is 50; maximum is 200.
