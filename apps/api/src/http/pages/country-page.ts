import { html } from "hono/html";
import type { CountrySummary } from "../../application/mappers.js";
import { API_PREFIX, DISCLAIMER, REPOSITORY_URL } from "../../domain/constants.js";

// Hono's `html` escapes every interpolated string, flattens arrays without
// separators, and leaves nested `html` fragments as they are.
type Fragment = ReturnType<typeof html>;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const numberFormat = new Intl.NumberFormat("en");

export function countryName(countryCode: string) {
  try {
    return regionNames.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

/** Server-rendered country page. English only until localization lands (#55). */
export async function renderCountryPage(summary: CountrySummary, origin: string) {
  const code = summary.countryCode;
  const name = countryName(code);
  const published = summary.coverage.status === "PUBLISHED";

  const body = html`
    <header class="page-header">
      <p class="country-page-code">IDRO country &middot; ${code}</p>
      <h1 class="page-title">${name}</h1>
      <p class="page-subtitle">${coverageLine(summary)}</p>
    </header>
    ${published ? searchSection(code, name) : emptyState(summary, name)}
    ${authoritiesSection(summary)} ${coverageSection(summary)} ${sourcesSection(summary)}
    ${linksSection(summary, published)}
  `;

  return page({
    title: `${name} (${code}) - Open IDRO Directory`,
    canonical: `${origin}/countries/${code.toLowerCase()}/`,
    body,
    // Only a country with identifiers has a search to enhance.
    scripts: published,
  });
}

// Copy of the search section. The client replaces the `data-i18n` texts with
// the same keys of EXPLORER_COPY in public/explorer.js; #55 localizes both.
const SEARCH_COPY = {
  title: "Search identifiers",
  scope: "Every search is limited to",
  placeholder: "Operator name or identifier",
  searchBtn: "Search",
  request: "API request",
  copy: "Copy",
  openJson: "Open JSON",
  showApiLabel: "Show API request",
  resolved: "Identifier resolved",
  viewProvenance: "View provenance",
  colId: "Identifier",
  colName: "Operator",
  colCountry: "Country",
  colStatus: "Status",
  colRoles: "Roles",
  loading: "Loading...",
  emptyTitle: "No results",
  emptyBody: "Adjust your search or filters.",
  more: "Load more",
  close: "Close",
  conflict: "Conflict",
  legalName: "Legal name",
  authority: "Authority level",
  roles: "Roles",
  lastSeen: "Last seen",
  website: "Website",
  provenance: "Provenance",
  provenanceSub: "Where this identifier comes from, and which authority to verify it with.",
} as const;

/**
 * The explorer's search, pinned to the page country. Hidden until
 * public/explorer.js reads the data attributes and unhides it, so the page
 * without JavaScript is the static content alone.
 */
function searchSection(code: string, name: string) {
  const t = SEARCH_COPY;
  const i18n = (key: keyof typeof SEARCH_COPY) => html`<span data-i18n="${key}">${t[key]}</span>`;
  return html`
    <section
      class="section country-section country-search"
      aria-labelledby="search-title"
      data-fixed-country="${code}"
      data-base-path="/countries/${code.toLowerCase()}/"
      hidden
    >
      <div class="section-heading">
        <h2 id="search-title">${t.title}</h2>
      </div>
      <div class="filter-panel">
        <form class="filter-form" id="explore-form">
          <label class="filter-search">
            <input id="query" type="text" autocomplete="off" placeholder="${t.placeholder}" />
          </label>
          <select id="role" aria-label="${t.colRoles}"></select>
          <select id="status" aria-label="${t.colStatus}"></select>
          <button class="primary-button" type="submit" data-i18n="searchBtn">${t.searchBtn}</button>
        </form>
        <p class="country-page-meta">${t.scope} <strong>${name}</strong>.</p>
        <div class="api-line" id="api-line" hidden>
          <span class="api-label" data-i18n="request">${t.request}</span>
          <code id="request-path"></code>
          <button class="ghost-button" type="button" id="copy-request" data-i18n="copy">
            ${t.copy}
          </button>
          <a class="open-json" id="open-json" href="#" target="_blank" rel="noreferrer"
            >${i18n("openJson")} ↗</a
          >
        </div>
        <div class="api-toggle-wrap">
          <button class="link-button" type="button" id="toggle-api">${i18n("showApiLabel")}</button>
        </div>
      </div>
      <p class="resolve-banner foreign-notice" id="foreign-notice" role="status" hidden></p>
      <div class="resolve-banner" id="resolve-banner" hidden>
        <div>
          <div class="resolve-eyebrow">${i18n("resolved")} · <span id="resolve-input"></span></div>
          <div class="resolve-main">
            <span class="resolve-name" id="resolve-name"></span>
            <span class="mono-id" id="resolve-emid"></span>
            <span id="resolve-status"></span>
          </div>
          <div class="resolve-sub" id="resolve-sub"></div>
        </div>
        <button class="secondary-button" type="button" id="open-resolved">
          ${i18n("viewProvenance")} →
        </button>
      </div>
      <div class="results-meta"><div class="result-label" id="result-label"></div></div>
      <div class="table-shell">
        <div class="table-head">
          ${i18n("colId")} ${i18n("colName")} ${i18n("colCountry")} ${i18n("colStatus")}
          ${i18n("colRoles")}<span></span>
        </div>
        <div id="results"></div>
        <div class="state-box" id="loading" hidden>
          <span class="spinner" aria-hidden="true"></span>${i18n("loading")}
        </div>
        <div class="empty-state" id="empty" hidden>
          <strong data-i18n="emptyTitle">${t.emptyTitle}</strong>${i18n("emptyBody")}
        </div>
      </div>
      <div class="load-more-wrap" id="load-more-wrap" hidden>
        <button class="load-more" type="button" id="load-more" data-i18n="more">${t.more}</button>
      </div>
      <div class="detail-backdrop" id="detail-backdrop" hidden></div>
      <aside class="detail-panel" id="detail-panel" aria-label="Party details" hidden>
        <div class="detail-header">
          <div class="detail-topline">
            <span class="mono-id" id="detail-emid"></span>
            <button class="close-button" type="button" id="close-detail" aria-label="${t.close}">
              ×
            </button>
          </div>
          <h2 class="detail-title" id="detail-name"></h2>
          <div class="detail-meta-line">
            <span id="detail-status"></span>
            <span class="detail-country" id="detail-country"></span>
            <span class="conflict-badge" id="detail-conflict" data-i18n="conflict" hidden
              >${t.conflict}</span
            >
          </div>
        </div>
        <div class="state-box" id="detail-loading" hidden>
          <span class="spinner" aria-hidden="true"></span>${i18n("loading")}
        </div>
        <div class="detail-body" id="detail-body" hidden>
          <div class="meta-grid">
            ${detailFact("legalName", "detail-legal-name")}
            ${detailFact("authority", "detail-authority")} ${detailFact("roles", "detail-roles")}
            ${detailFact("lastSeen", "detail-last-seen")}
            <div class="meta-item full" id="detail-website-wrap" hidden>
              <div class="meta-label" data-i18n="website">${t.website}</div>
              <div class="meta-value">
                <a id="detail-website" href="#" target="_blank" rel="noreferrer"></a>
              </div>
            </div>
          </div>
          <div class="panel-section">
            <div class="panel-title" data-i18n="provenance">${t.provenance}</div>
            <p class="panel-subtitle" data-i18n="provenanceSub">${t.provenanceSub}</p>
            <div id="observations"></div>
          </div>
          <div class="detail-api">
            <code id="detail-path"></code>
            <a id="detail-open-json" href="#" target="_blank" rel="noreferrer"
              >${i18n("openJson")} ↗</a
            >
          </div>
        </div>
      </aside>
    </section>
  `;
}

// shared.js is a classic script whose globals explorer.js reads.
const SEARCH_SCRIPTS = html`<script src="/shared.js"></script>
  <script type="module" src="/explorer.js"></script>`;

function detailFact(key: keyof typeof SEARCH_COPY, id: string) {
  return html`<div>
    <div class="meta-label" data-i18n="${key}">${SEARCH_COPY[key]}</div>
    <div class="meta-value" id="${id}"></div>
  </div>`;
}

const ERROR_TITLES: Record<number, string> = {
  400: "Conflicting country",
  404: "Page not found",
  503: "Data temporarily unavailable",
};

export async function renderErrorPage(status: number, message: string, requestId: string) {
  const title = ERROR_TITLES[status] ?? "Something went wrong";
  return page({
    title: `${title} - Open IDRO Directory`,
    body: html`
      <header class="page-header">
        <h1 class="page-title">${title}</h1>
        <p class="page-subtitle">${message}</p>
      </header>
      <p><a class="text-link" href="/#pays">Browse countries</a></p>
      <p><a class="text-link" href="/explore/">Search all identifiers</a></p>
      <p class="country-page-meta">Request id: ${requestId}</p>
    `,
  });
}

function coverageLine(summary: CountrySummary) {
  const sourceCount = summary.sources.filter(
    (source) => source.countryObservations.total > 0,
  ).length;
  if (summary.coverage.status !== "PUBLISHED") {
    return "A known IDRO, with no published identifiers.";
  }
  return `${count(summary.statistics.parties, "identifier")} published by ${count(sourceCount, "source")}.`;
}

function emptyState(summary: CountrySummary, name: string) {
  const authorities = summary.authorities
    .map((authority) => authority.name)
    .filter((authorityName): authorityName is string => Boolean(authorityName));
  const holder =
    authorities.length > 0
      ? new Intl.ListFormat("en", { type: "conjunction" }).format(authorities)
      : "The national authority";
  // Verbs and pronouns agree with the number of authorities named.
  const several = authorities.length > 1;
  const manages = several ? "manage" : "manages";
  const publishes = several ? "publish" : "publishes";
  const its = several ? "Their" : "Its";
  const listed = summary.sources.filter((source) => source.publication.machineReadableUrl);
  // Only a list the directory has retrieved can be said to hold no identifiers.
  const retrieved = listed.filter((source) => source.health.lastSuccessfulAt).length;
  // Plain strings, escaped when interpolated below.
  let explanation: string;
  if (listed.length === 0) {
    explanation =
      `${holder} ${manages} e-mobility identifiers for ${name}, ` +
      `but ${publishes} no machine-readable list of them, so this directory holds none.`;
  } else if (retrieved === 0) {
    explanation =
      listed.length === 1
        ? `${holder} ${manages} e-mobility identifiers for ${name} and ${publishes} a ` +
          "machine-readable list, but this directory has not retrieved it yet, so it holds none."
        : `${holder} ${manages} e-mobility identifiers for ${name} and ${publishes} ` +
          "machine-readable lists, but this directory has not retrieved them yet, so it holds none.";
  } else if (retrieved < listed.length) {
    explanation =
      `${holder} ${manages} e-mobility identifiers for ${name}. ` +
      `The lists retrieved so far hold no identifiers for ${name}, and others have not been ` +
      "retrieved yet, so this directory holds none.";
  } else {
    explanation =
      `${holder} ${manages} e-mobility identifiers for ${name}. ` +
      (listed.length === 1
        ? `${its} published list holds no identifiers for ${name} yet, so this directory holds none.`
        : `${its} published lists hold no identifiers for ${name} yet, so this directory holds none.`);
  }
  return html`
    <section class="trust-card country-empty" aria-labelledby="empty-title">
      <h2 id="empty-title">No published identifiers</h2>
      <p>
        ${explanation} Ask the ${several ? "authorities" : "authority"} below to verify an
        identifier.
      </p>
    </section>
  `;
}

function authoritiesSection(summary: CountrySummary) {
  const cards = summary.authorities.map(
    (authority) => html`
      <article class="trust-card">
        <h3>
          ${link(authority.homepageUrl, authority.name ?? authority.id ?? "Unnamed authority")}
        </h3>
        <dl class="meta-grid">
          ${fact("Level", authority.level ?? "Unknown")}
          ${fact("Jurisdictions", authority.jurisdictions.join(", "))}
          ${fact("Sources", authority.sourceIds.length > 0 ? authority.sourceIds.join(", ") : "None")}
        </dl>
        ${authority.notes ? html`<p>${authority.notes}</p>` : ""}
      </article>
    `,
  );
  return section(
    "authorities",
    "IDRO authorities",
    cards.length > 0
      ? html`<div class="country-cards">${cards}</div>`
      : html`<p>No IDRO authority is recorded for this country.</p>`,
  );
}

function coverageSection(summary: CountrySummary) {
  const { coverage, statistics } = summary;
  return section(
    "coverage",
    "Coverage",
    html`
      <dl class="meta-grid country-facts">
        ${fact("Status", coverage.status === "PUBLISHED" ? "Published" : "No published identifiers")}
        ${fact("Declared roles", coverage.declaredRoles ? listOrNone(coverage.declaredRoles) : "Unknown")}
        ${fact("Published roles", countsOrNone(coverage.publishedRoles))}
        ${fact("Identifiers", format(statistics.parties))}
        ${fact("Identifier roles", format(statistics.partyRoles))}
        ${fact("Observations", format(statistics.observations))}
        ${fact("Conflicts", format(statistics.conflicts))}
        ${fact("By status", countsOrNone(statistics.countsByStatus))}
      </dl>
    `,
  );
}

function sourcesSection(summary: CountrySummary) {
  const cards = summary.sources.map(
    (source) => html`
      <article class="trust-card">
        <h3>${source.name}</h3>
        <dl class="meta-grid">
          ${fact("Source id", source.id)} ${fact("Authority", source.authority.name ?? "Unknown")}
          ${fact("Register", source.registry.url ? link(source.registry.url, source.registry.url) : "Unknown")}
          ${fact("Observation type", source.registry.observationType)}
          ${fact(
            "Machine-readable list",
            source.publication.machineReadableUrl
              ? link(source.publication.machineReadableUrl, source.publication.machineReadableUrl)
              : "Not published",
          )}
          ${fact("Freshness", source.health.freshness)}
          ${fact("Last successful retrieval", source.health.lastSuccessfulAt ? timestamp(source.health.lastSuccessfulAt) : "Never")}
          ${fact(
            `Observations in ${summary.countryCode}`,
            source.countryObservations.total > 0
              ? `${format(source.countryObservations.total)} (${counts(source.countryObservations.byAuthorityLevel)})`
              : "None",
          )}
        </dl>
      </article>
    `,
  );
  return section(
    "sources",
    "Sources",
    cards.length > 0
      ? html`<div class="country-cards">${cards}</div>`
      : html`<p>No source covers this country.</p>`,
  );
}

function linksSection(summary: CountrySummary, published: boolean) {
  const code = summary.countryCode;
  return section(
    "data",
    "Data",
    html`
      <ul class="country-links">
        ${
          published
            ? html`<li>
                <a class="text-link" href="/explore/?country=${code}"
                  >Search ${countryName(code)} identifiers in the explorer</a
                >
              </li>`
            : ""
        }
        <li>
          <a class="text-link" href="${API_PREFIX}/countries/${code}">This summary as JSON</a>
        </li>
      </ul>
      <p class="country-page-meta">Dataset generated ${timestamp(summary.datasetTimestamp)}.</p>
    `,
  );
}

function section(id: string, title: string, content: Fragment) {
  return html`
    <section class="section country-section" aria-labelledby="${id}-title">
      <div class="section-heading">
        <h2 id="${id}-title">${title}</h2>
      </div>
      ${content}
    </section>
  `;
}

function fact(label: string, value: string | Fragment) {
  return html`<div class="meta-item">
    <dt class="meta-label">${label}</dt>
    <dd class="meta-value">${value}</dd>
  </div>`;
}

/** Links only http(s) URLs; anything else is upstream data shown as text. */
function link(url: string | null, label: string) {
  if (url && /^https?:\/\//i.test(url)) {
    return html`<a href="${url}" rel="noreferrer">${label}</a>`;
  }
  return html`${label}`;
}

function listOrNone(values: string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

function counts(values: Record<string, number>) {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${format(value)}`)
    .join(", ");
}

function countsOrNone(values: Record<string, number>) {
  return Object.keys(values).length > 0 ? counts(values) : "None";
}

function count(value: number, noun: string) {
  return `${format(value)} ${noun}${value === 1 ? "" : "s"}`;
}

function format(value: number) {
  return numberFormat.format(value);
}

function timestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

async function page({
  title,
  canonical,
  body,
  scripts = false,
}: {
  title: string;
  canonical?: string;
  body: Fragment;
  scripts?: boolean;
}) {
  const document = await html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        ${canonical ? html`<link rel="canonical" href="${canonical}" />` : ""}
        <link rel="icon" type="image/png" href="/assets/favicon.png" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="site-shell">
          <nav class="topbar">
            <div class="topbar-inner">
              <a class="brand" href="/" aria-label="Open IDRO Directory">
                <span class="brand-name">Open IDRO Directory</span>
              </a>
              <div class="nav-links">
                <a href="/explore/">Explorer</a>
                <a href="/#pays">Countries</a>
                <a href="/#sources">Trust</a>
                <a class="nav-muted" href="/docs">API</a>
              </div>
            </div>
          </nav>
          <main class="content country-page">${body}</main>
          <footer class="site-footer">
            <div class="footer-inner">
              <div class="footer-about">
                <p>${DISCLAIMER}</p>
              </div>
              <div class="footer-links">
                <div>
                  <a href="/explore/">Explorer</a>
                  <a href="/#pays">Countries</a>
                  <a href="${REPOSITORY_URL}" rel="noreferrer">GitHub</a>
                </div>
              </div>
            </div>
          </footer>
        </div>
        ${scripts ? SEARCH_SCRIPTS : ""}
      </body>
    </html>`;
  return document.toString();
}
