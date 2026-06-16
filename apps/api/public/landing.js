const LANDING_FALLBACK_STATS = {
  totalParties: 5817,
  totalPartyRoles: 7929,
  totalObservations: 7932,
  totalConflicts: 0,
  countsByCountry: {
    AT: 1107,
    BE: 224,
    CH: 98,
    DE: 1784,
    DK: 61,
    ES: 257,
    FI: 23,
    FR: 671,
    GR: 131,
    HU: 1,
    IE: 16,
    LT: 8,
    LU: 138,
    LV: 9,
    NL: 235,
    PL: 742,
    PT: 72,
    SE: 52,
    SI: 30,
  },
  countsByIdentifierCountry: {
    AT: 1107,
    BE: 357,
    CH: 160,
    DE: 3076,
    DK: 81,
    ES: 314,
    FI: 40,
    FR: 726,
    GR: 131,
    HU: 1,
    IE: 26,
    LT: 8,
    LU: 225,
    LV: 15,
    NL: 365,
    PL: 836,
    PT: 98,
    SE: 52,
    SI: 56,
  },
  countsByRole: { CPO: 5373, EMSP: 2559 },
  datasetTimestamp: "2026-06-16T06:34:16.059Z",
};

const LANDING_FALLBACK_ROOT = {
  dataset: {
    recordCount: 7932,
    sourceCount: 20,
    generatedAt: "2026-06-16T06:34:16.059Z",
  },
};

const ADD_COUNTRY_ISSUE_URL =
  "https://github.com/juherr/open-idro-directory/issues/new?template=add-country.yml";

const KNOWN_UNPUBLISHED_COUNTRIES = [
  {
    code: "CY",
    url: "https://www.mcw.gov.cy/mcw/ems/ems.nsf/All/D764FAE19922743BC2258DAA002FA4BC?OpenDocument",
  },
];

const COMING_SOON_COUNTRIES = ["BG", "CZ", "EE", "IT", "LU", "MT", "RO", "SK"];

const LANDING_COPY = {
  fr: {
    navExplore: "Explorer",
    navCountries: "Pays",
    navSources: "Confiance",
    byAuthor: "Un projet de",
    kicker: "Données interrogées en direct via l'API",
    heroTitle: "Tous les identifiants e-mobilité d'Europe, au même endroit.",
    heroSub:
      "Recherchez un opérateur, un identifiant ou un pays. Open IDRO Directory rassemble les registres IDRO officiels et vous laisse naviguer librement dans la donnée.",
    searchPlaceholder: "Identifiant, opérateur ou pays... (ex. FR026, AFIREV, Allemagne)",
    searchBtn: "Rechercher",
    chipsLabel: "Recherches fréquentes :",
    live: "En direct",
    updated: "mis à jour",
    source: "source :",
    mIdentifiers: "Identifiants e-mobilité",
    mParties: "Opérateurs & organisations",
    mCountries: "Pays couverts",
    mSources: "Registres sources",
    cpo: "CPO",
    emsp: "EMSP",
    roleSplit: "Répartition par rôle",
    identifiersShort: "identifiants",
    idroKnownUnavailable: "IDRO connu, liste non diffusée",
    comingSoon: "à venir",
    pendingOfficialIdroSource: "identifiants via une autre source",
    addCountryTitle: "Ajouter votre pays",
    addCountryBody: "Partagez une page IDRO officielle, une URL de registre ou un contact public.",
    countriesTitle: "Parcourir par pays",
    countriesSub:
      "Sélectionnez un pays pour explorer ses identifiants et leurs sources officielles.",
    seeAll: "Tout explorer →",
    trust1Title: "Provenance vérifiable",
    trust1Body:
      "Chaque valeur conserve son registre d'origine, l'URL source et l'horodatage de collecte.",
    trust2Title: "Toujours à jour",
    trust2Body:
      "Les sources sont rafraîchies en continu ; une source en échec est signalée, jamais effacée.",
    trust3Title: "Accès libre",
    trust3Body:
      "Consultation gratuite, sans compte ni clé. Données ouvertes en lecture seule pour tous.",
    ctaTitle: "Explorez l'annuaire complet",
    ctaSub:
      "Filtrez par pays, rôle (CPO / EMSP) et statut. Recherchez un identifiant et remontez jusqu'à sa source.",
    ctaBtn: "Explorer les données",
    devNote: "Développeur ? Tout est aussi disponible via l'API",
    disclaimer:
      "Projet d'agrégation indépendant. Open IDRO Directory n'émet pas d'identifiants et ne fait pas autorité — référez-vous à l'IDRO d'origine pour toute vérification légale ou opérationnelle.",
  },
  en: {
    navExplore: "Explore",
    navCountries: "Countries",
    navSources: "Trust",
    byAuthor: "A project by",
    kicker: "Live data, queried through the API",
    heroTitle: "Every e-mobility identifier in Europe, in one place.",
    heroSub:
      "Search an operator, an identifier or a country. Open IDRO Directory brings together official IDRO registries and lets you browse the data freely.",
    searchPlaceholder: "Identifier, operator or country... (e.g. FR026, AFIREV, Germany)",
    searchBtn: "Search",
    chipsLabel: "Popular searches:",
    live: "Live",
    updated: "updated",
    source: "source:",
    mIdentifiers: "e-Mobility identifiers",
    mParties: "Operators & organizations",
    mCountries: "Countries covered",
    mSources: "Source registries",
    cpo: "CPO",
    emsp: "EMSP",
    roleSplit: "Split by role",
    identifiersShort: "identifiers",
    idroKnownUnavailable: "IDRO known, list unavailable",
    comingSoon: "coming soon",
    pendingOfficialIdroSource: "identifiers via another source",
    addCountryTitle: "Add your country",
    addCountryBody: "Share an official IDRO page, registry URL or public contact.",
    countriesTitle: "Browse by country",
    countriesSub: "Pick a country to explore its identifiers and their official sources.",
    seeAll: "Explore all →",
    trust1Title: "Verifiable provenance",
    trust1Body:
      "Every value keeps its originating registry, source URL and the timestamp it was retrieved.",
    trust2Title: "Always fresh",
    trust2Body:
      "Sources are refreshed continuously; a failed source is flagged, never silently dropped.",
    trust3Title: "Open access",
    trust3Body: "Free to browse, no account or key. Open, read-only data for everyone.",
    ctaTitle: "Explore the full directory",
    ctaSub:
      "Filter by country, role (CPO / EMSP) and status. Search an identifier and trace it back to its source.",
    ctaBtn: "Explore the data",
    devNote: "A developer? Everything is also available via the API",
    disclaimer:
      "Independent aggregation project. Open IDRO Directory does not issue identifiers and is not authoritative — refer to the originating IDRO for any legal or operational verification.",
  },
};

const landingState = {
  root: LANDING_FALLBACK_ROOT,
  stats: LANDING_FALLBACK_STATS,
};

function translateLanding() {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  updateLanguageButtons(lang);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (LANDING_COPY[lang][key]) element.textContent = LANDING_COPY[lang][key];
  });
  document.querySelector("#landing-query").placeholder = LANDING_COPY[lang].searchPlaceholder;
}

function renderLanding() {
  const lang = getLanguage();
  translateLanding();
  renderStats();
  renderCountries();
  renderChips(lang);
}

function renderStats() {
  const lang = getLanguage();
  const stats = landingState.stats || LANDING_FALLBACK_STATS;
  const root = landingState.root || LANDING_FALLBACK_ROOT;
  const countries = stats.countsByIdentifierCountry || stats.countsByCountry || {};
  const cpo = stats.countsByRole?.CPO || 0;
  const emsp = stats.countsByRole?.EMSP || 0;
  const roleTotal = cpo + emsp || 1;
  const timestamp = stats.datasetTimestamp || root.dataset?.generatedAt;

  setText(
    "#metric-identifiers",
    formatNumber(stats.totalPartyRoles ?? stats.totalObservations, lang),
  );
  setText("#metric-parties", formatNumber(stats.totalParties, lang));
  setText("#metric-countries", formatNumber(Object.keys(countries).length, lang));
  setText("#metric-sources", formatNumber(root.dataset?.sourceCount || 0, lang));
  setText("#metric-cpo", formatNumber(cpo, lang));
  setText("#metric-emsp", formatNumber(emsp, lang));
  setText("#updated-at", relativeTime(timestamp, lang));

  document.querySelector("#split-cpo").style.width = `${((100 * cpo) / roleTotal).toFixed(1)}%`;
  document.querySelector("#split-emsp").style.width = `${((100 * emsp) / roleTotal).toFixed(1)}%`;
}

function renderCountries() {
  const lang = getLanguage();
  const stats = landingState.stats || LANDING_FALLBACK_STATS;
  const countries = stats.countsByIdentifierCountry || stats.countsByCountry || {};
  const supported = Object.keys(countries)
    .sort((left, right) => countries[right] - countries[left])
    .map((code) => ({
      code,
      count: countries[code],
      href: `/explore/?country=${encodeURIComponent(code)}`,
      status: COMING_SOON_COUNTRIES.includes(code) ? "coming-soon" : "supported",
    }));
  const knownUnpublished = KNOWN_UNPUBLISHED_COUNTRIES.map((country) => ({
    ...country,
    count: 0,
    href: country.url,
    status: "known-unpublished",
  }));
  const comingSoon = COMING_SOON_COUNTRIES.filter((code) => !countries[code]).map((code) => ({
    code,
    count: 0,
    href: null,
    status: "coming-soon",
  }));
  const html = [...supported, ...knownUnpublished, ...comingSoon]
    .map((country) => countryCardHtml(country, lang))
    .join("");
  const ctaHtml = `
    <a class="country-card country-card-cta" href="${ADD_COUNTRY_ISSUE_URL}" target="_blank" rel="noreferrer">
      <div class="country-card-top">
        <span class="country-flag" aria-hidden="true">+</span>
        <span class="country-code">IDRO</span>
      </div>
      <div class="country-name">${escapeHtml(LANDING_COPY[lang].addCountryTitle)}</div>
      <div class="country-caption">${escapeHtml(LANDING_COPY[lang].addCountryBody)}</div>
    </a>
  `;
  setHtml("#country-grid", html + ctaHtml);
}

function countryCardHtml(country, lang) {
  const content = `
    <div class="country-card-top">
      <span class="country-flag" aria-hidden="true">${escapeHtml(countryFlag(country.code))}</span>
      <span class="status-dot ${country.status}"></span>
    </div>
    <div class="country-name">${escapeHtml(countryName(country.code, lang))}</div>
    ${country.count > 0 ? `<div class="country-count">${escapeHtml(formatNumber(country.count, lang))}</div>` : ""}
    <div class="country-caption">${escapeHtml(countryStatusCaption(country, lang))}</div>
  `;
  const className = `country-card country-card-${country.status}`;
  if (!country.href)
    return `<article class="${className}" aria-label="${escapeHtml(countryName(country.code, lang))}">${content}</article>`;
  const target = country.href.startsWith("http") ? ' target="_blank" rel="noreferrer"' : "";
  return `<a class="${className}" href="${escapeHtml(country.href)}"${target}>${content}</a>`;
}

function countryStatusCaption(country, lang) {
  if (country.status === "known-unpublished") return LANDING_COPY[lang].idroKnownUnavailable;
  if (country.status === "coming-soon" && country.count > 0)
    return LANDING_COPY[lang].pendingOfficialIdroSource;
  if (country.status === "coming-soon") return LANDING_COPY[lang].comingSoon;
  return LANDING_COPY[lang].identifiersShort;
}

function countryFlag(code) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function renderChips(lang) {
  const chips =
    lang === "fr"
      ? [
          ["Allemagne", "country=DE"],
          ["AFIREV", "q=AFIREV"],
          ["FR026", "q=FR026"],
          ["CPO", "role=CPO"],
          ["Belgique", "country=BE"],
        ]
      : [
          ["Germany", "country=DE"],
          ["AFIREV", "q=AFIREV"],
          ["FR026", "q=FR026"],
          ["CPO", "role=CPO"],
          ["Belgium", "country=BE"],
        ];
  setHtml(
    "#popular-chips",
    chips
      .map(([label, query]) => `<a class="chip" href="/explore/?${query}">${escapeHtml(label)}</a>`)
      .join(""),
  );
}

async function loadLandingData() {
  try {
    const [stats, root] = await Promise.all([
      apiGet("/api/v1/stats?view=landing"),
      apiGet("/api/v1"),
    ]);
    landingState.stats = stats.data;
    landingState.root = root.data;
  } catch {
    landingState.stats = LANDING_FALLBACK_STATS;
    landingState.root = LANDING_FALLBACK_ROOT;
  }
  renderLanding();
}

document.querySelector("#landing-search").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = document.querySelector("#landing-query").value.trim();
  window.location.href = query ? `/explore/?q=${encodeURIComponent(query)}` : "/explore/";
});

bindLanguageButtons(renderLanding);
renderLanding();
void loadLandingData();
setInterval(renderStats, 60000);
