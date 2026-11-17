export const COUNTRY_PAGE_PREFIX = "/countries";

export type CountryPageRoute =
  | { kind: "render"; countryCode: string }
  | { kind: "redirect"; location: string }
  | { kind: "conflict" }
  | { kind: "not-found" };

const COUNTRY_PATH = /^\/countries\/([A-Za-z]{2})\/?$/;

export function isCountryPagePath(path: string) {
  return path === COUNTRY_PAGE_PREFIX || path.startsWith(`${COUNTRY_PAGE_PREFIX}/`);
}

/**
 * Maps a request URL onto the canonical country page `/countries/{code}/`.
 *
 * The path country is the source of truth. A `country` query parameter is
 * redundant when it names the same country and is dropped by a redirect; when it
 * names another one the request is a conflict. Conflicts are detected before any
 * redirect, so an uppercase path with a conflicting parameter is rejected rather
 * than redirected first.
 */
export function resolveCountryPage(url: URL): CountryPageRoute {
  const match = COUNTRY_PATH.exec(url.pathname);
  if (!match) return { kind: "not-found" };
  const countryCode = (match[1] ?? "").toUpperCase();

  const countryParams = url.searchParams.getAll("country");
  if (countryParams.some((value) => value !== "" && value.toUpperCase() !== countryCode)) {
    return { kind: "conflict" };
  }

  const canonicalPath = `${COUNTRY_PAGE_PREFIX}/${countryCode.toLowerCase()}/`;
  if (url.pathname === canonicalPath && countryParams.length === 0) {
    return { kind: "render", countryCode };
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete("country");
  const query = params.toString();
  return { kind: "redirect", location: query ? `${canonicalPath}?${query}` : canonicalPath };
}
