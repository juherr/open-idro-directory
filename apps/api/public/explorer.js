// ES module: the helpers of the classic shared.js script, loaded before it,
// stay reachable as globals.
import {
  countryPagePath,
  createSearchScope,
  existingCountryPagePath,
  pageLanguage,
} from "/explorer-core.js";

// A country page hosts this search in a section pinned to its country; the
// explorer page has no such section.
const fixedRoot = document.querySelector("[data-fixed-country]");

// The country page is server-rendered in the language of <html lang>, which
// wins over the stored `oid-lang` and is never overwritten.
function currentLanguage() {
  return pageLanguage({
    fixed: Boolean(fixedRoot),
    htmlLang: document.documentElement.lang,
    stored: fixedRoot ? "" : getLanguage(),
  });
}

const scope = fixedRoot
  ? createSearchScope({
      fixedCountry: fixedRoot.dataset.fixedCountry,
      knownCountries: Object.keys(COUNTRY_NAMES.en),
      lang: currentLanguage(),
    })
  : createSearchScope();

const EXPLORER_COPY = {
  fr: {
    home: "Accueil",
    explore: "Explorer",
    title: "Explorateur de données",
    subtitle: "Recherchez, filtrez et remontez chaque identifiant jusqu'à sa source officielle.",
    searchPlaceholder: "Nom d'opérateur ou identifiant (ex. IONITY, FR-026)...",
    searchBtn: "Rechercher",
    request: "Requête API",
    openJson: "Ouvrir le JSON",
    loading: "Chargement...",
    showApiLabel: "Voir la requête API",
    hideApiLabel: "Masquer la requête API",
    colId: "Identifiant",
    colName: "Opérateur",
    colCountry: "Pays",
    colStatus: "Statut",
    colRoles: "Rôles",
    emptyTitle: "Aucun résultat",
    emptyBody: "Ajustez votre recherche ou vos filtres.",
    resolved: "Identifiant résolu",
    viewProvenance: "Voir la provenance",
    conflict: "Conflit",
    legalName: "Raison sociale",
    authority: "Niveau d'autorité",
    roles: "Rôles",
    lastSeen: "Vu pour la dernière fois",
    website: "Site web",
    provenance: "Provenance",
    provenanceSub: "D'où provient cet identifiant, et chez quelle autorité le vérifier.",
    obType: "Type d'observation",
    scheme: "Schéma",
    sourceValue: "Valeur source",
    retrieved: "Collecté",
    viewSource: "Voir la source officielle",
    allCountries: "Tous les pays",
    allRoles: "Tous les rôles",
    allStatus: "Tous les statuts",
    results: "opérateurs affichés",
    more: "Charger plus",
    copy: "Copier",
    copied: "Copié",
    context: "Annuaire IDRO",
    navCountries: "Pays",
    navTrust: "Confiance",
    byAuthor: "Un projet de",
    disclaimer:
      "Projet d'agrégation indépendant. Open IDRO Directory n'émet pas d'identifiants et ne fait pas autorité — référez-vous à l'IDRO d'origine pour toute vérification légale ou opérationnelle.",
    belongsTo: "{id} relève d'un autre pays : {country}.",
  },
  en: {
    home: "Home",
    explore: "Explore",
    title: "Data explorer",
    subtitle: "Search, filter and trace every identifier back to its official source.",
    searchPlaceholder: "Operator name or identifier (e.g. IONITY, FR-026)...",
    searchBtn: "Search",
    request: "API request",
    openJson: "Open JSON",
    loading: "Loading...",
    showApiLabel: "Show API request",
    hideApiLabel: "Hide API request",
    colId: "Identifier",
    colName: "Operator",
    colCountry: "Country",
    colStatus: "Status",
    colRoles: "Roles",
    emptyTitle: "No results",
    emptyBody: "Adjust your search or filters.",
    resolved: "Identifier resolved",
    viewProvenance: "View provenance",
    conflict: "Conflict",
    legalName: "Legal name",
    authority: "Authority level",
    roles: "Roles",
    lastSeen: "Last seen",
    website: "Website",
    provenance: "Provenance",
    provenanceSub: "Where this identifier comes from, and which authority to verify it with.",
    obType: "Observation type",
    scheme: "Scheme",
    sourceValue: "Source value",
    retrieved: "Retrieved",
    viewSource: "View official source",
    allCountries: "All countries",
    allRoles: "All roles",
    allStatus: "All statuses",
    results: "operators shown",
    more: "Load more",
    copy: "Copy",
    copied: "Copied",
    context: "IDRO directory",
    navCountries: "Countries",
    navTrust: "Trust",
    byAuthor: "A project by",
    disclaimer:
      "Independent aggregation project. Open IDRO Directory does not issue identifiers and is not authoritative — refer to the originating IDRO for any legal or operational verification.",
    belongsTo: "{id} belongs to {country}.",
  },
};

const state = {
  q: "",
  country: "",
  role: "",
  status: "",
  items: [],
  cursor: null,
  loading: false,
  lastPath: "/api/v1/parties?limit=25",
  resolve: null,
  sourceNames: {},
  countsByCountry: {},
  roleCache: new Map(),
  showApi: false,
  copied: false,
  selectedParty: null,
  detailPath: "",
  detailCountry: "",
  foreign: null,
};

// Absent on a country page, whose country is fixed.
const countrySelect = document.querySelector("#country");

function initFromUrl() {
  Object.assign(state, scope.readState(window.location.search));
  document.querySelector("#query").value = state.q;
  if (countrySelect) countrySelect.value = state.country;
  document.querySelector("#role").value = state.role;
  document.querySelector("#status").value = state.status;
  // A country page keeps only q, role and status in its URL: a stray
  // parameter (a country, an unknown key) is dropped at once.
  if (fixedRoot) {
    const canonical = scope.buildPageUrl(state);
    if (canonical !== window.location.pathname + window.location.search) {
      history.replaceState(null, "", canonical);
    }
  }
}

function translateExplorer() {
  const lang = currentLanguage();
  if (!fixedRoot) document.documentElement.lang = lang;
  updateLanguageButtons(lang);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (EXPLORER_COPY[lang][key]) element.textContent = EXPLORER_COPY[lang][key];
  });
  if (!fixedRoot)
    document.querySelector("#query").placeholder = EXPLORER_COPY[lang].searchPlaceholder;
  document.querySelector("#toggle-api span").textContent = state.showApi
    ? EXPLORER_COPY[lang].hideApiLabel
    : EXPLORER_COPY[lang].showApiLabel;
  document.querySelector("#copy-request").textContent = state.copied
    ? EXPLORER_COPY[lang].copied
    : EXPLORER_COPY[lang].copy;
  renderContextLabel();
}

function renderExplorer() {
  translateExplorer();
  renderDetailCountry();
  renderOptions();
  renderApiLine();
  renderResolve();
  renderRows();
}

function renderOptions() {
  const lang = currentLanguage();
  const copy = EXPLORER_COPY[lang];
  const codes = availableCountryCodes().sort((left, right) =>
    countryName(left, lang).localeCompare(countryName(right, lang), lang),
  );
  setHtml(
    "#country",
    [`<option value="">${escapeHtml(copy.allCountries)}</option>`]
      .concat(
        codes.map(
          (code) =>
            `<option value="${escapeHtml(code)}"${state.country === code ? " selected" : ""}>${escapeHtml(countryName(code, lang))}</option>`,
        ),
      )
      .join(""),
  );
  setHtml(
    "#role",
    [
      `<option value="">${escapeHtml(copy.allRoles)}</option>`,
      `<option value="CPO"${state.role === "CPO" ? " selected" : ""}>CPO</option>`,
      `<option value="EMSP"${state.role === "EMSP" ? " selected" : ""}>EMSP</option>`,
    ].join(""),
  );
  setHtml(
    "#status",
    [
      `<option value="">${escapeHtml(copy.allStatus)}</option>`,
      ...["ACTIVE", "INACTIVE", "RESERVED", "UNKNOWN"].map(
        (status) =>
          `<option value="${status}"${state.status === status ? " selected" : ""}>${escapeHtml(statusLabel(status, lang))}</option>`,
      ),
    ].join(""),
  );
}

function renderContextLabel() {
  const lang = currentLanguage();
  const count = availableCountryCodes().length;
  const suffix =
    lang === "fr" ? `${count} pays` : `${count} ${count === 1 ? "country" : "countries"}`;
  const label = escapeHtml(`${EXPLORER_COPY[lang].context} · ${suffix}`);
  const country = state.country ? ` · ${countryLink(state.country, lang)}` : "";
  setHtml("[data-i18n='context']", label + country);
}

/** The country name, linked to its country page, in `lang`, when the code is valid. */
function countryLink(code, lang) {
  const name = escapeHtml(countryName(code, lang));
  return linkOrName(countryPagePath(code, lang), name);
}

/** `name` (already escaped) linked to `path`, or plain when `path` is empty. */
function linkOrName(path, name) {
  return path ? `<a class="text-link" href="${escapeHtml(path)}">${name}</a>` : name;
}

function availableCountryCodes() {
  const countedCodes = Object.keys(state.countsByCountry || {});
  return countedCodes.length ? countedCodes : FALLBACK_COUNTRIES;
}

function syncUrl() {
  history.replaceState(null, "", scope.buildPageUrl(state));
}

// Bumped by every new query: a response of a superseded one is dropped.
let queryGeneration = 0;

async function runQuery(path, append = false) {
  if (!path) return;
  const generation = queryGeneration;
  state.loading = !append;
  state.lastPath = path;
  renderRows();
  renderApiLine();
  try {
    const json = await apiGet(path);
    if (generation !== queryGeneration) return;
    const items = json.data?.items || [];
    state.items = append ? state.items.concat(items) : items;
    state.cursor = json.data?.pagination?.nextCursor || null;
    state.loading = false;
    renderRows();
    void enrichRoles(items);
  } catch {
    if (generation !== queryGeneration) return;
    state.items = append ? state.items : [];
    state.cursor = null;
    state.loading = false;
    renderRows();
  }
}

async function enrichRoles(items) {
  const missing = items.filter((item) => !state.roleCache.has(item.key));
  if (!missing.length) return;
  await Promise.all(
    missing.map(async (item) => {
      try {
        const json = await apiGet(`/api/v1/parties/${item.countryCode}/${item.partyId}`);
        const roles = [...new Set((json.data?.roles || []).map((role) => role.role))];
        state.roleCache.set(item.key, roles);
      } catch {
        state.roleCache.set(item.key, []);
      }
    }),
  );
  renderRows();
}

/** Runs the plan of the current state: a search, or the foreign-ID notice. */
function startQuery() {
  queryGeneration += 1;
  const plan = scope.planQuery(state);
  state.foreign = plan.kind === "foreign-identifier" ? plan : null;
  renderForeignNotice();
  if (state.foreign) {
    state.resolve = null;
    state.items = [];
    state.cursor = null;
    state.loading = false;
    state.lastPath = "";
    renderResolve();
    renderRows();
    renderApiLine();
    return;
  }
  void resolveIdentifier(plan.resolvePath);
  void runQuery(plan.searchPath);
}

function renderForeignNotice() {
  const notice = document.querySelector("#foreign-notice");
  if (!notice) return;
  notice.hidden = !state.foreign;
  if (!state.foreign) return;
  const lang = currentLanguage();
  const [before, after] = EXPLORER_COPY[lang].belongsTo.split("{country}");
  // Linked only once the stats show the country has a page: before they
  // load, or when they fail, the name stays plain text.
  const code = state.foreign.countryCode;
  const name = escapeHtml(countryName(code, lang));
  const path = existingCountryPagePath(code, state.countsByCountry, lang);
  notice.innerHTML =
    escapeHtml(before.replace("{id}", state.foreign.emobilityId)) +
    linkOrName(path, name) +
    escapeHtml(after);
}

async function resolveIdentifier(path) {
  if (!path) {
    state.resolve = null;
    renderResolve();
    return;
  }
  const generation = queryGeneration;
  let resolved = null;
  try {
    const json = await apiGet(path);
    resolved = json.data?.party ? { input: json.data.input, party: json.data.party } : null;
  } catch {
    resolved = null;
  }
  if (generation !== queryGeneration) return;
  state.resolve = resolved;
  renderResolve();
}

function renderApiLine() {
  // Empty on a foreign identifier, for which nothing is fetched.
  document.querySelector("#api-line").hidden = !state.showApi || !state.lastPath;
  setText("#request-path", `GET ${state.lastPath}`);
  setHref("#open-json", `${API_BASE}${state.lastPath}`);
  document.querySelector("#toggle-api span").textContent = state.showApi
    ? EXPLORER_COPY[currentLanguage()].hideApiLabel
    : EXPLORER_COPY[currentLanguage()].showApiLabel;
}

function renderResolve() {
  const banner = document.querySelector("#resolve-banner");
  if (!state.resolve?.party) {
    banner.hidden = true;
    return;
  }
  const lang = currentLanguage();
  const party = state.resolve.party;
  banner.hidden = false;
  setText("#resolve-input", state.resolve.input);
  setText("#resolve-name", party.preferredName || party.legalName || party.eMobilityId);
  setText("#resolve-emid", formatIdentifier(party.countryCode, party.partyId));
  setHtml("#resolve-status", statusBadge(party.status, lang));
  const roles = party.roles?.length
    ? party.roles.map((role) => role.role).join(", ")
    : `${party.roleCount || 0} ${EXPLORER_COPY[lang].roles.toLowerCase()}`;
  setText("#resolve-sub", `${countryName(party.countryCode, lang)} · ${roles}`);
}

function renderRows() {
  const lang = currentLanguage();
  const copy = EXPLORER_COPY[lang];
  document.querySelector("#loading").hidden = !state.loading;
  document.querySelector("#empty").hidden =
    state.loading || state.items.length > 0 || Boolean(state.foreign);
  document.querySelector("#load-more-wrap").hidden = !state.cursor || state.loading;
  setText(
    "#result-label",
    state.loading || state.foreign ? "" : `${state.items.length} ${copy.results}`,
  );

  if (state.loading) {
    setHtml("#results", "");
    return;
  }

  setHtml(
    "#results",
    state.items
      .map((item) => {
        const roles = state.roleCache.get(item.key);
        const roleHtml =
          roles === undefined
            ? Array.from({ length: item.roleCount || 1 })
                .map(() => '<span class="skeleton-pill"></span>')
                .join("")
            : roles.length
              ? roles.map(roleBadge).join("")
              : '<span style="font-size:13px;color:#b8c4cf;">—</span>';
        const name = item.preferredName || item.legalName || item.eMobilityId;
        const subtitle =
          item.legalName && item.legalName !== item.preferredName ? item.legalName : "";
        return `
          <button class="table-row" type="button" data-country="${escapeHtml(item.countryCode)}" data-party="${escapeHtml(item.partyId)}">
            <span class="row-id">${escapeHtml(formatIdentifier(item.countryCode, item.partyId))}</span>
            <span class="row-name">
              <strong>${escapeHtml(name)}</strong>
              <span>${escapeHtml(subtitle)}</span>
            </span>
            <span class="row-country">${escapeHtml(countryName(item.countryCode, lang))}</span>
            <span>${statusBadge(item.status, lang)}</span>
            <span class="role-list">${roleHtml}</span>
            <span class="row-arrow">›</span>
          </button>
        `;
      })
      .join(""),
  );

  document.querySelectorAll(".table-row").forEach((row) => {
    row.addEventListener("click", () => openDetail(row.dataset.country, row.dataset.party));
  });
}

async function openDetail(countryCode, partyId) {
  const base = `/api/v1/parties/${countryCode}/${partyId}`;
  state.detailPath = base;
  document.body.classList.add("detail-open");
  document.querySelector("#detail-backdrop").hidden = false;
  document.querySelector("#detail-panel").hidden = false;
  document.querySelector("#detail-loading").hidden = false;
  document.querySelector("#detail-body").hidden = true;
  try {
    const [detailJson, observationsJson] = await Promise.all([
      apiGet(base),
      apiGet(`${base}/observations`),
    ]);
    renderDetail(detailJson.data, observationsJson.data?.items || []);
  } catch {
    document.querySelector("#detail-loading").hidden = true;
    document.querySelector("#detail-body").hidden = false;
    setHtml("#observations", "");
  }
}

function renderDetail(detail, observations) {
  const lang = currentLanguage();
  const copy = EXPLORER_COPY[lang];
  document.querySelector("#detail-loading").hidden = true;
  document.querySelector("#detail-body").hidden = false;
  setText("#detail-emid", formatIdentifier(detail.countryCode, detail.partyId));
  setText("#detail-name", detail.preferredName || detail.legalName || detail.eMobilityId);
  setHtml("#detail-status", statusBadge(detail.status, lang));
  state.detailCountry = detail.countryCode;
  renderDetailCountry();
  document.querySelector("#detail-conflict").hidden = !detail.hasConflict;
  setText("#detail-legal-name", detail.legalName || "—");
  setText(
    "#detail-authority",
    (detail.highestAuthorityLevel || "—").toLowerCase().replace(/^./, (char) => char.toUpperCase()),
  );
  setText(
    "#detail-roles",
    detail.roles?.length
      ? detail.roles
          .map((role) => `${role.role}${role.status ? ` (${statusLabel(role.status, lang)})` : ""}`)
          .join(", ")
      : String(detail.roleCount || "—"),
  );
  setText("#detail-last-seen", relativeTime(detail.lastSeenAt, lang));
  document.querySelector("#detail-website-wrap").hidden = !detail.website;
  const safeWebsite = safeExternalUrl(detail.website);
  document.querySelector("#detail-website-wrap").hidden = !safeWebsite;
  if (safeWebsite) {
    setText("#detail-website", safeWebsite);
    setHref("#detail-website", safeWebsite);
  }
  setText("#detail-path", `GET ${state.detailPath}`);
  setHref("#detail-open-json", `${API_BASE}${state.detailPath}`);

  setHtml(
    "#observations",
    observations
      .map((observation) => {
        const metadata = observation.metadata || {};
        const metaHtml = Object.keys(metadata)
          .slice(0, 4)
          .filter((key) => metadata[key] != null && metadata[key] !== "")
          .map(
            (key) =>
              `<div class="meta-extra"><span>${escapeHtml(key)}:</span> ${escapeHtml(String(metadata[key]))}</div>`,
          )
          .join("");
        const dot = observation.authorityLevel === "AUTHORITATIVE" ? "#1f9d55" : "#9a6a16";
        const sourceName = state.sourceNames[observation.sourceId] || observation.sourceId;
        const sourceUrl = safeExternalUrl(observation.sourceUrl);
        const sourceLink = sourceUrl
          ? `<a class="source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(copy.viewSource)} ↗</a>`
          : "";
        return `
          <article class="observation-card">
            <div class="observation-head">
              <span class="source-name"><span class="status-dot" style="background:${dot}"></span>${escapeHtml(sourceName)}</span>
              <span class="source-id">${escapeHtml(observation.sourceId)}</span>
            </div>
            <div class="observation-grid">
              <div><span>${escapeHtml(copy.obType)}</span><div>${escapeHtml(formatEnum(observation.observationType))}</div></div>
              <div><span>${escapeHtml(copy.scheme)}</span><div>${escapeHtml(formatEnum(observation.scheme))}</div></div>
              <div><span>${escapeHtml(copy.sourceValue)}</span><div>${escapeHtml(observation.sourceValue || observation.sourceRecordId || "—")}</div></div>
              <div><span>${escapeHtml(copy.retrieved)}</span><div>${escapeHtml(relativeTime(observation.retrievedAt || observation.lastSeenAt, lang))}</div></div>
            </div>
            ${metaHtml}
            ${sourceLink}
          </article>
        `;
      })
      .join(""),
  );
}

/** The detail panel's country link, rebuilt in the current language on a toggle. */
function renderDetailCountry() {
  if (state.detailCountry)
    setHtml("#detail-country", countryLink(state.detailCountry, currentLanguage()));
}

function formatEnum(value) {
  return (value || "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function closeDetail() {
  document.body.classList.remove("detail-open");
  document.querySelector("#detail-backdrop").hidden = true;
  document.querySelector("#detail-panel").hidden = true;
}

function submitSearch() {
  state.q = document.querySelector("#query").value.trim();
  if (countrySelect) state.country = countrySelect.value;
  state.role = document.querySelector("#role").value;
  state.status = document.querySelector("#status").value;
  syncUrl();
  renderContextLabel();
  startQuery();
}

async function loadContext() {
  // The stats feed the country select and the context label of the
  // explorer, and the country link of a country page's foreign notice.
  await loadStats();
  try {
    const sources = await apiGet("/api/v1/sources");
    state.sourceNames = Object.fromEntries(
      (sources.data?.items || []).map((source) => [source.id, source.name]),
    );
  } catch {
    state.sourceNames = {};
  }
}

async function loadStats() {
  try {
    const stats = await apiGet("/api/v1/stats");
    state.countsByCountry =
      stats.data?.countsByIdentifierCountry || stats.data?.countsByCountry || {};
    renderOptions();
    renderContextLabel();
    // Writes the notice of the current query only: state.foreign is reset
    // by every new query.
    renderForeignNotice();
  } catch {
    state.countsByCountry = {};
    renderContextLabel();
  }
}

document.querySelector("#explore-form").addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch();
});

countrySelect?.addEventListener("change", submitSearch);
document.querySelector("#role").addEventListener("change", submitSearch);
document.querySelector("#status").addEventListener("change", submitSearch);
document.querySelector("#toggle-api").addEventListener("click", () => {
  state.showApi = !state.showApi;
  renderApiLine();
});
document.querySelector("#copy-request").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${API_BASE}${state.lastPath}`);
  } catch {
    /* Clipboard can be unavailable in non-secure local contexts. */
  }
  state.copied = true;
  translateExplorer();
  setTimeout(() => {
    state.copied = false;
    translateExplorer();
  }, 1500);
});
document
  .querySelector("#load-more")
  .addEventListener("click", () => runQuery(scope.buildApiPath(state, state.cursor), true));
document.querySelector("#open-resolved").addEventListener("click", () => {
  if (state.resolve?.party)
    void openDetail(state.resolve.party.countryCode, state.resolve.party.partyId);
});
document.querySelector("#detail-backdrop").addEventListener("click", closeDetail);
document.querySelector("#close-detail").addEventListener("click", closeDetail);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetail();
});

bindLanguageButtons(renderExplorer);
renderOptions();
initFromUrl();
renderExplorer();
void loadContext();
startQuery();
// Revealed only once init ran: a failure leaves the no-JS page as served.
if (fixedRoot) fixedRoot.hidden = false;
