const LANDING_FALLBACK_STATS = {
  totalParties: 5402,
  totalObservations: 7362,
  totalConflicts: 0,
  countsByCountry: {
    AT: 1107,
    BE: 224,
    CH: 98,
    DE: 1784,
    DK: 61,
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
    FI: 40,
    FR: 726,
    GR: 131,
    HU: 1,
    IE: 26,
    LT: 8,
    LU: 225,
    LV: 15,
    NL: 365,
    PL: 838,
    PT: 98,
    SE: 52,
    SI: 56,
  },
  countsByRole: { CPO: 5002, EMSP: 2360 },
  datasetTimestamp: "2026-06-15T06:39:47.501Z",
};

const LANDING_FALLBACK_ROOT = {
  dataset: {
    recordCount: 7362,
    sourceCount: 20,
    generatedAt: "2026-06-15T06:39:47.501Z",
  },
};

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

  setText("#metric-identifiers", formatNumber(stats.totalObservations, lang));
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
  const html = Object.keys(countries)
    .sort((left, right) => countries[right] - countries[left])
    .map(
      (code) => `
        <a class="country-card" href="/explore/?country=${encodeURIComponent(code)}">
          <div class="country-card-top">
            <span class="country-code">${escapeHtml(code)}</span>
            <span class="status-dot"></span>
          </div>
          <div class="country-name">${escapeHtml(countryName(code, lang))}</div>
          <div class="country-count">${escapeHtml(formatNumber(countries[code], lang))}</div>
          <div class="country-caption">${escapeHtml(LANDING_COPY[lang].identifiersShort)}</div>
        </a>
      `,
    )
    .join("");
  setHtml("#country-grid", html);
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
    const [stats, root] = await Promise.all([apiGet("/api/v1/stats"), apiGet("/api/v1")]);
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
