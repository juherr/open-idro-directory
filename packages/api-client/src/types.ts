/**
 * The payloads the website reads, written by hand from `apps/api/src/application/mappers.ts`
 * and the inline handlers of `apps/api/src/http/app.ts` (API schema 1.4.0).
 *
 * Enumerated values (roles, statuses, authority levels, confirmations) stay `string`: the API
 * types them so, from its D1 rows, and narrowing them here would claim a guarantee the API
 * does not make. `tests/types.test.ts` checks each mapper's return type against these.
 */

/** `datasetPayload`. */
export interface Dataset {
  releaseId: string;
  gitCommitSha: string;
  gitRef: string;
  schemaVersion: string;
  checksum: string;
  recordCount: number;
  sourceCount: number;
  generatedAt: string;
  importedAt: string;
  importerVersion: string;
  downloads: {
    registryJson: string;
    registryNdjson: string;
    registryCsv: string;
    sourcesJson: string;
    statsJson: string;
  };
}

/** `GET /api/v1`. */
export interface ApiIndex {
  name: string;
  version: string;
  disclaimer: string;
  dataset: Dataset;
  links: {
    openapi: string;
    docs: string;
    health: string;
    dataset: string;
    sources: string;
    parties: string;
    stats: string;
    countries: string;
    github: string;
  };
}

/** `GET /api/v1/stats`. Every `countsBy*` maps a key to a count. */
export interface Stats {
  totalParties: number;
  totalPartyRoles: number;
  totalObservations: number;
  totalConflicts: number;
  /** Same as `countsByIdentifierCountry`, kept for older consumers. */
  countsByCountry: Record<string, number>;
  countsByIdentifierCountry: Record<string, number>;
  countsByPartyCountry: Record<string, number>;
  countsByRole: Record<string, number>;
  countsByStatus: Record<string, number>;
  countsByAuthorityLevel: Record<string, number>;
  countsBySource: Record<string, number>;
  conflictCounts: Record<string, number>;
  datasetTimestamp: string;
}

/** The issuing-register confirmation of one role (API 1.4.0). */
export interface IssuingConfirmationPayload {
  /** `null` until the first import after migration 0006. */
  confirmation: string | null;
  /** Source ids; `null` when unknown. */
  confirmedBy: string[] | null;
}

export interface PartyRole {
  role: string;
  status: string;
  highestAuthorityLevel: string;
  observationCount: number;
  hasConflict: boolean;
  issuing: IssuingConfirmationPayload;
}

/** `partyPayload`: a consolidated party. `roles` is empty in list answers. */
export interface Party {
  key: string;
  countryCode: string;
  issuingCountry: string;
  partyId: string;
  eMobilityId: string;
  preferredName: string | null;
  legalName: string | null;
  website: string | null;
  status: string;
  highestAuthorityLevel: string;
  roleCount: number;
  observationCount: number;
  hasConflict: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  roles: PartyRole[];
}

/** `GET /api/v1/parties/:cc/:id`: the party with its summaries. */
export interface PartyDetail extends Party {
  alternativeNames: string[];
  sourceSummary: Array<{ id: string; url: string }>;
  conflictSummary: { count: number; severities: string[] };
  freshnessSummary: { latestRetrievedAt: string | null };
  links: { observations: string; conflicts: string };
}

/** `listPayload`: one page and the opaque cursor of the next, `null` on the last page. */
export interface Page<T> {
  items: T[];
  pagination: { nextCursor: string | null };
}

/** `observationPayload`. */
export interface Observation {
  key: string;
  partyKey: string;
  sourceId: string;
  scheme: string;
  countryCode: string;
  partyId: string;
  eMobilityId: string;
  role: string;
  status: string;
  organizationName: string | null;
  legalName: string | null;
  website: string | null;
  sourceRecordId: string | null;
  sourceValue: string;
  sourceUrl: string;
  authorityLevel: string;
  observationType: string;
  /** `null` until the first import after migration 0006. */
  observationKind: string | null;
  observingJurisdiction: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  retrievedAt: string;
  metadata: Record<string, unknown>;
  rawRecordChecksum: string | null;
}

export interface SourceAuthority {
  id: string | null;
  name: string | null;
  level: string;
  jurisdictions: string[];
  homepageUrl: string | null;
  notes: string | null;
}

export interface SourceReference {
  name: string;
  url: string;
}

/** `sourcePayload`. */
export interface Source {
  id: string;
  name: string;
  authority: SourceAuthority;
  registry: {
    url: string | null;
    observationType: string;
    jurisdictions: string[];
    /** `null` until the first import after migration 0005. */
    supportedRoles: string[] | null;
  };
  publication: { machineReadableUrl: string | null; verifiedAt: string | null };
  // Flat fields kept by the API for consumers of schema 1.1.x.
  authorityName: string | null;
  authorityLevel: string;
  observationType: string;
  official: boolean;
  homepageUrl: string | null;
  registryUrl: string | null;
  machineReadableUrl: string | null;
  verifiedAt: string | null;
  jurisdictions: string[];
  reuse: {
    status: string;
    legalBasis: SourceReference | null;
    licence: SourceReference | null;
    attributionNotice: string | null;
    redistributionAllowed: boolean | null;
    notes: string | null;
  };
  health: {
    status: string;
    freshness: string;
    recordCount: number;
    lastAttemptedAt: string | null;
    lastSuccessfulAt: string | null;
    lastChangedAt: string | null;
    latestErrorSummary: string | null;
    checksum: string | null;
  };
  disclaimer: string;
}

/** `GET /api/v1/sources`: every source, unpaginated. */
export interface SourceList {
  items: Source[];
}

/** A source in a country summary, with what it observed for that country. */
export interface CountrySource extends Source {
  countryObservations: { total: number; byAuthorityLevel: Record<string, number> };
}

/** `countrySummaryPayload`: `GET /api/v1/countries/:code`. */
export interface CountrySummary {
  countryCode: string;
  authorities: Array<SourceAuthority & { sourceIds: string[] }>;
  sources: CountrySource[];
  coverage: {
    status: string;
    /** `null` while no declaring source lists its roles. */
    declaredRoles: string[] | null;
    publishedRoles: Record<string, number>;
  };
  statistics: {
    parties: number;
    partyRoles: number;
    observations: number;
    conflicts: number;
    countsByStatus: Record<string, number>;
  };
  freshness: { latestSuccessfulRetrievalAt: string | null; staleSourceIds: string[] };
  datasetTimestamp: string;
  links: { self: string; parties: string; conflicts: string };
}

/** `GET /api/v1/resolve/:id`. `party` is `null` when the identifier is not listed. */
export interface Resolution {
  input: string;
  warnings: string[];
  ambiguous: boolean;
  party: Party | null;
}
