/** An identifier typed by a user, normalized to the registry's form. */
export interface IdentifierInput {
  /** Two upper-case letters, e.g. `FR`. */
  countryCode: string;
  /** Three upper-case characters, e.g. `AB1`. */
  partyId: string;
  /** `countryCode` followed by `partyId`, e.g. `FRAB1`. */
  emobilityId: string;
}

/** The URL-backed part of a search. Every field is `""` when unset. */
export interface SearchState {
  q: string;
  country: string;
  role: string;
  status: string;
}

/** Run `searchPath`, and `resolvePath` too when it is not `null`. */
export interface SearchPlan {
  kind: "search";
  searchPath: string;
  resolvePath: string | null;
}

/**
 * The query is an identifier of another country than the scope's fixed
 * country: nothing is fetched. Data only, the caller words the message.
 */
export interface ForeignIdentifierPlan {
  kind: "foreign-identifier";
  countryCode: string;
  emobilityId: string;
}

export type QueryPlan = SearchPlan | ForeignIdentifierPlan;

export interface SearchScopeOptions {
  /**
   * Pins every search to this country (normalized to upper case). It is
   * neither read from nor written to the page URL. Omit it for the explorer.
   */
  fixedCountry?: string;
  /** Path of the page that hosts the search. Defaults to `/explore/`. */
  basePath?: string;
}

export interface SearchScope {
  /** The upper-case fixed country, or `null` in explorer mode. */
  readonly fixedCountry: string | null;
  readonly basePath: string;
  /** Reads `q`, `country`, `role` and `status` from a `location.search` string. */
  readState(search: string): SearchState;
  /** `/api/v1/parties?...` for the state; `cursor` is appended when truthy. */
  buildApiPath(state: SearchState, cursor?: string | null): string;
  /** `basePath` plus the state's query string, without `?` when empty. */
  buildPageUrl(state: SearchState): string;
  /** `/api/v1/resolve/...` for an identifier-looking query of the scope, else `null`. */
  resolvePath(q: string): string | null;
  /** What to fetch for the state. */
  planQuery(state: SearchState): QueryPlan;
}

export function normalizeIdentifierInput(value: string): IdentifierInput | null;
export function isIdentifierLike(value: string): boolean;
export function createSearchScope(options?: SearchScopeOptions): SearchScope;
