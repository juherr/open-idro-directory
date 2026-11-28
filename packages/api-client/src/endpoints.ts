import type { ApiClient, ApiResult, QueryValue, RequestOptions } from "./transport.js";
import type {
  ApiIndex,
  CountrySummary,
  Observation,
  Page,
  Party,
  PartyDetail,
  Resolution,
  SourceList,
  Stats,
} from "./types.js";

export interface EndpointDefinition {
  readonly method: "GET";
  /** The OpenAPI path template: `{name}` marks a path parameter. */
  readonly path: string;
  /** The only query parameters the client may send. */
  readonly query: readonly string[];
}

/**
 * Every endpoint the website reads, declared once. The methods of `createDirectoryApi` are
 * built from it, and the contract tests check it against the OpenAPI document and the app.
 */
export const ENDPOINTS = {
  index: { method: "GET", path: "/api/v1", query: [] },
  stats: { method: "GET", path: "/api/v1/stats", query: [] },
  sources: { method: "GET", path: "/api/v1/sources", query: [] },
  country: { method: "GET", path: "/api/v1/countries/{countryCode}", query: [] },
  parties: {
    method: "GET",
    path: "/api/v1/parties",
    query: ["country", "role", "status", "q", "emobilityId", "limit", "cursor"],
  },
  party: { method: "GET", path: "/api/v1/parties/{countryCode}/{partyId}", query: [] },
  partyObservations: {
    method: "GET",
    path: "/api/v1/parties/{countryCode}/{partyId}/observations",
    query: [],
  },
  resolve: { method: "GET", path: "/api/v1/resolve/{emobilityId}", query: [] },
} as const satisfies Record<string, EndpointDefinition>;

/** The roles `partyListQuerySchema` accepts (`apps/api/src/http/validation.ts`). */
export type PartyRoleFilter = "CPO" | "CSO" | "EMSP" | "NSP" | "HUB" | "OTHER";
/** The statuses `partyListQuerySchema` accepts. */
export type PartyStatusFilter = "ACTIVE" | "INACTIVE" | "RESERVED" | "REVOKED" | "UNKNOWN";

/** The filters the site sends to `GET /api/v1/parties`; it sends `q` or `emobilityId`. */
export interface PartyListQuery {
  /** ISO 3166-1 alpha-2. */
  country?: string | undefined;
  role?: PartyRoleFilter | undefined;
  status?: PartyStatusFilter | undefined;
  /** Name search, 2 to 80 characters. */
  q?: string | undefined;
  emobilityId?: string | undefined;
  /** 1 to 200; the API defaults to 50. */
  limit?: number | undefined;
  /** `pagination.nextCursor` of the previous page. */
  cursor?: string | undefined;
}

export type EndpointOptions = Pick<RequestOptions, "ifNoneMatch" | "signal">;

export interface DirectoryApi {
  index(options?: EndpointOptions): Promise<ApiResult<ApiIndex>>;
  stats(options?: EndpointOptions): Promise<ApiResult<Stats>>;
  sources(options?: EndpointOptions): Promise<ApiResult<SourceList>>;
  country(countryCode: string, options?: EndpointOptions): Promise<ApiResult<CountrySummary>>;
  parties(query?: PartyListQuery, options?: EndpointOptions): Promise<ApiResult<Page<Party>>>;
  party(
    countryCode: string,
    partyId: string,
    options?: EndpointOptions,
  ): Promise<ApiResult<PartyDetail>>;
  partyObservations(
    countryCode: string,
    partyId: string,
    options?: EndpointOptions,
  ): Promise<ApiResult<Page<Observation>>>;
  resolve(emobilityId: string, options?: EndpointOptions): Promise<ApiResult<Resolution>>;
}

/** Fills each `{name}` of the template with its encoded value. */
export function endpointPath(endpoint: EndpointDefinition, params: Record<string, string> = {}) {
  return endpoint.path.replaceAll(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new TypeError(`Missing path parameter "${name}" for ${endpoint.path}.`);
    }
    return encodeURIComponent(value);
  });
}

export function createDirectoryApi(client: ApiClient): DirectoryApi {
  const get = <T>(
    endpoint: EndpointDefinition,
    params: Record<string, string>,
    options: EndpointOptions = {},
    query: Record<string, QueryValue> = {},
  ) =>
    client.request<T>(endpointPath(endpoint, params), {
      ...options,
      query: declaredQuery(endpoint, query),
    });

  return {
    index: (options) => get(ENDPOINTS.index, {}, options),
    stats: (options) => get(ENDPOINTS.stats, {}, options),
    sources: (options) => get(ENDPOINTS.sources, {}, options),
    country: (countryCode, options) => get(ENDPOINTS.country, { countryCode }, options),
    parties: (query = {}, options) => get(ENDPOINTS.parties, {}, options, { ...query }),
    party: (countryCode, partyId, options) =>
      get(ENDPOINTS.party, { countryCode, partyId }, options),
    partyObservations: (countryCode, partyId, options) =>
      get(ENDPOINTS.partyObservations, { countryCode, partyId }, options),
    resolve: (emobilityId, options) => get(ENDPOINTS.resolve, { emobilityId }, options),
  };
}

/** Keeps only the parameters the endpoint declares, so the table is the whole contract. */
function declaredQuery(endpoint: EndpointDefinition, query: Record<string, QueryValue>) {
  return Object.fromEntries(
    endpoint.query.filter((name) => query[name] !== undefined).map((name) => [name, query[name]]),
  );
}
