// Pure search state for the explorer and the country pages. No DOM, no
// network: callers read `location.search`, write `history` and fetch the
// paths returned here. Types live in explorer-core.d.ts.

const PAGE_SIZE = "25";

export function normalizeIdentifierInput(value) {
  const input = value.trim().toUpperCase();
  const separated = /^([A-Z]{2})[-*]([A-Z0-9]{3})$/.exec(input);
  const compact = separated || /^([A-Z]{2})([A-Z0-9*]{3})$/.exec(input);
  if (!compact) return null;
  return {
    countryCode: compact[1],
    partyId: compact[2],
    emobilityId: `${compact[1]}${compact[2]}`,
  };
}

export function isIdentifierLike(value) {
  return normalizeIdentifierInput(value) !== null;
}

export function createSearchScope({ fixedCountry, basePath = "/explore/" } = {}) {
  const forced = fixedCountry ? fixedCountry.toUpperCase() : null;

  function identifierOf(q) {
    return q ? normalizeIdentifierInput(q) : null;
  }

  function isForeign(identifier) {
    return Boolean(forced && identifier && identifier.countryCode !== forced);
  }

  function readState(search) {
    const params = new URLSearchParams(search);
    return {
      q: params.get("q") || "",
      country: forced ?? (params.get("country") || ""),
      role: params.get("role") || "",
      status: params.get("status") || "",
    };
  }

  function buildApiPath(state, cursor = null) {
    const params = new URLSearchParams();
    const country = forced ?? state.country;
    if (country) params.set("country", country);
    if (state.role) params.set("role", state.role);
    if (state.status) params.set("status", state.status);
    const identifier = identifierOf(state.q);
    if (identifier) params.set("emobilityId", identifier.emobilityId);
    else if (state.q) params.set("q", state.q.trim());
    params.set("limit", PAGE_SIZE);
    if (cursor) params.set("cursor", cursor);
    return `/api/v1/parties?${params.toString()}`;
  }

  function buildPageUrl(state) {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (!forced && state.country) params.set("country", state.country);
    if (state.role) params.set("role", state.role);
    if (state.status) params.set("status", state.status);
    const suffix = params.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  }

  function resolvePath(q) {
    const identifier = identifierOf(q);
    if (!identifier || isForeign(identifier)) return null;
    return `/api/v1/resolve/${encodeURIComponent(identifier.emobilityId)}`;
  }

  function planQuery(state) {
    const identifier = identifierOf(state.q);
    if (isForeign(identifier)) {
      return {
        kind: "foreign-identifier",
        countryCode: identifier.countryCode,
        emobilityId: identifier.emobilityId,
      };
    }
    return { kind: "search", searchPath: buildApiPath(state), resolvePath: resolvePath(state.q) };
  }

  return {
    fixedCountry: forced,
    basePath,
    readState,
    buildApiPath,
    buildPageUrl,
    resolvePath,
    planQuery,
  };
}
