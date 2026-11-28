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

/** `?lang=fr` for French; English is the default page language, with no query. */
function languageQuery(lang) {
  return lang === "fr" ? "?lang=fr" : "";
}

/**
 * The language the explorer renders in. A country page (`fixed`) is
 * server-rendered in the language of `<html lang>`, which wins over the
 * stored `oid-lang`; anything but `fr` there is English. Elsewhere the
 * stored (or browser-preferred) language `stored` is kept as is.
 */
export function pageLanguage({ fixed, htmlLang, stored }) {
  if (!fixed) return stored;
  return htmlLang === "fr" ? "fr" : "en";
}

/**
 * `/countries/{lc}/` for a two-letter country code, else `null`. The page
 * language `lang` is passed in, never read from storage here.
 */
export function countryPagePath(code, lang) {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return null;
  return `/countries/${code.toLowerCase()}/${languageQuery(lang)}`;
}

/**
 * The country page path of `code` when the stats count identifiers for it,
 * else `null`: a country without identifiers has no page.
 */
export function existingCountryPagePath(code, counts, lang) {
  const path = countryPagePath(code, lang);
  if (!path || !counts) return null;
  return Number(counts[code.toUpperCase()]) > 0 ? path : null;
}

export function createSearchScope({
  fixedCountry,
  basePath: givenBasePath,
  knownCountries,
  lang,
} = {}) {
  const forced = fixedCountry ? fixedCountry.toUpperCase() : null;
  // A country page hosts the search at its own path; an invalid code has no
  // page, so it falls back to the explorer rather than to `null`.
  const basePath = givenBasePath ?? (forced ? countryPagePath(forced) : null) ?? "/explore/";
  const known = new Set(knownCountries ?? []);

  // In fixed-country mode, a compact input (no `-`/`*` after the prefix)
  // whose prefix is neither the fixed country nor a known one is a name
  // such as TESLA, searched as text.
  function identifierOf(q) {
    const identifier = q ? normalizeIdentifierInput(q) : null;
    if (!identifier || !forced || identifier.countryCode === forced) return identifier;
    const separated = /^[A-Z]{2}[-*]/.test(q.trim().toUpperCase());
    return separated || known.has(identifier.countryCode) ? identifier : null;
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
    const identifier = identifierOf(state.q);
    if (isForeign(identifier)) return null;
    const params = new URLSearchParams();
    const country = forced ?? state.country;
    if (country) params.set("country", country);
    if (state.role) params.set("role", state.role);
    if (state.status) params.set("status", state.status);
    if (identifier) params.set("emobilityId", identifier.emobilityId);
    else if (state.q) params.set("q", state.q.trim());
    params.set("limit", PAGE_SIZE);
    if (cursor) params.set("cursor", cursor);
    return `/api/v1/parties?${params.toString()}`;
  }

  function buildPageUrl(state) {
    const params = new URLSearchParams();
    // A French country page keeps its language: a reload must not serve English.
    if (forced && lang === "fr") params.set("lang", "fr");
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

// Labels of the detail panel, worded as the server-rendered country page
// words them (COUNTRY_PAGE_COPY in country-page-copy.ts). Static browser
// scripts cannot import that module, so the wording is copied here.
const ENUM_LABELS = {
  en: {
    authorityLevel: {
      AUTHORITATIVE: "Authoritative",
      SUPRANATIONAL_DIRECTORY: "Supranational directory",
      SECONDARY: "Secondary",
      SELF_ASSERTED: "Self-asserted",
      UNVERIFIED: "Unverified",
    },
    observationType: {
      OFFICIAL_ASSIGNMENT: "Official assignment",
      OFFICIAL_DIRECTORY_ENTRY: "Official directory entry",
      LEGACY_ASSIGNMENT: "Legacy assignment",
      NETWORK_REGISTRATION: "Network registration",
      INFRASTRUCTURE_OBSERVATION: "Infrastructure observation",
      SELF_DECLARATION: "Self-declaration",
      COMMUNITY_OBSERVATION: "Community observation",
    },
  },
  fr: {
    authorityLevel: {
      AUTHORITATIVE: "Faisant autorité",
      SUPRANATIONAL_DIRECTORY: "Annuaire supranational",
      SECONDARY: "Secondaire",
      SELF_ASSERTED: "Auto-déclaré",
      UNVERIFIED: "Non vérifié",
    },
    observationType: {
      OFFICIAL_ASSIGNMENT: "Attribution officielle",
      OFFICIAL_DIRECTORY_ENTRY: "Entrée d'annuaire officiel",
      LEGACY_ASSIGNMENT: "Attribution historique",
      NETWORK_REGISTRATION: "Enregistrement réseau",
      INFRASTRUCTURE_OBSERVATION: "Observation d'infrastructure",
      SELF_DECLARATION: "Auto-déclaration",
      COMMUNITY_OBSERVATION: "Observation communautaire",
    },
  },
};

/** An enum value in sentence case, underscores as spaces; `—` when empty. */
export function formatEnum(value) {
  return (value || "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

// The label of `value` in the `kind` dictionary of `lang` (French for "fr",
// English otherwise); an unknown value falls back to `formatEnum`.
function enumLabel(kind, value, lang) {
  const labels = ENUM_LABELS[lang === "fr" ? "fr" : "en"][kind];
  return Object.hasOwn(labels, value) ? labels[value] : formatEnum(value);
}

/**
 * The highest authority level of an identifier in `lang`, worded as the
 * country page does. An unknown value falls back to `formatEnum`.
 */
export function authorityLevelLabel(value, lang) {
  return enumLabel("authorityLevel", value, lang);
}

/**
 * The type of an observation in `lang`, worded as the country page does.
 * An unknown value falls back to `formatEnum`.
 */
export function observationTypeLabel(value, lang) {
  return enumLabel("observationType", value, lang);
}
