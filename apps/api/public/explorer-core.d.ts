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
  /**
   * Path of the page that hosts the search. Defaults to the fixed country's
   * page (`/countries/{lc}/`), or to `/explore/` without a valid one.
   */
  basePath?: string;
  /**
   * Upper-case country codes, read in fixed-country mode only. A compact
   * query (no `-`/`*` after the prefix) whose prefix is neither the fixed
   * country nor listed here is a text search, e.g. `TESLA`. A separated
   * query (`XX*ABC`, `XX-ABC`) stays an identifier whatever its prefix.
   */
  knownCountries?: Iterable<string>;
  /**
   * Language of a country page, from its `<html lang>`. `fr` keeps
   * `lang=fr` in the page URL; any other value adds nothing. Ignored in
   * explorer mode.
   */
  lang?: string | undefined;
}

export interface SearchScope {
  /** The upper-case fixed country, or `null` in explorer mode. */
  readonly fixedCountry: string | null;
  readonly basePath: string;
  /** Reads `q`, `country`, `role` and `status` from a `location.search` string. */
  readState(search: string): SearchState;
  /**
   * `/api/v1/parties?...` for the state; `cursor` is appended when truthy.
   * `null` when the query is a foreign identifier of a fixed-country scope:
   * nothing is to be fetched. Never `null` in explorer mode.
   */
  buildApiPath(state: SearchState, cursor?: string | null): string | null;
  /**
   * `basePath` plus the state's query string, without `?` when empty. A
   * French fixed-country scope puts `lang=fr` first.
   */
  buildPageUrl(state: SearchState): string;
  /** `/api/v1/resolve/...` for an identifier-looking query of the scope, else `null`. */
  resolvePath(q: string): string | null;
  /** What to fetch for the state. */
  planQuery(state: SearchState): QueryPlan;
}

export function normalizeIdentifierInput(value: string): IdentifierInput | null;
/**
 * The language the explorer renders in. On a country page (`fixed`) it is
 * `<html lang>` (`fr`, anything else English), never the stored `oid-lang`;
 * elsewhere it is `stored`, the stored or browser-preferred language.
 */
export function pageLanguage(options: {
  fixed: boolean;
  htmlLang: string | null | undefined;
  stored: string;
}): string;
/**
 * `/countries/{lc}/` for a two-letter country code, else `null`, with
 * `?lang=fr` when `lang` is `fr`. English, the default, adds nothing.
 */
export function countryPagePath(code: string, lang?: string): string | null;
/**
 * `countryPagePath(code, lang)` when `counts` (the stats' identifier counts, keyed
 * by upper-case code) is above zero for the code, else `null`: a country
 * without identifiers has no page.
 */
export function existingCountryPagePath(
  code: string,
  counts: Record<string, number> | null | undefined,
  lang?: string,
): string | null;
export function createSearchScope(options?: SearchScopeOptions): SearchScope;
/** An enum value in sentence case, underscores as spaces; `—` when empty. */
export function formatEnum(value: string | null | undefined): string;
/**
 * The highest authority level in `lang`, worded as the country page does.
 * An unknown value falls back to `formatEnum`.
 */
export function authorityLevelLabel(value: string | null | undefined, lang: string): string;
/**
 * The observation type in `lang`, worded as the country page does. An
 * unknown value falls back to `formatEnum`.
 */
export function observationTypeLabel(value: string | null | undefined, lang: string): string;
