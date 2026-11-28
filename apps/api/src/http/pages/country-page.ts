import { html, raw } from "hono/html";
import type { CountrySummary } from "../../application/mappers.js";
import { API_PREFIX, REPOSITORY_URL } from "../../domain/constants.js";
import {
  COUNTRY_PAGE_COPY,
  type EmptyState,
  type PageCopy,
  type PageLanguage,
  type Plural,
} from "./country-page-copy.js";

export { COUNTRY_PAGE_COPY, pageLanguage, type PageLanguage } from "./country-page-copy.js";

// Hono's `html` escapes every interpolated string, flattens arrays without
// separators, and leaves nested `html` fragments as they are.
type Fragment = ReturnType<typeof html>;

/** The copy and the `Intl` formatters of one page language. */
interface Locale {
  lang: PageLanguage;
  t: PageCopy;
  regions: Intl.DisplayNames;
  numbers: Intl.NumberFormat;
  plurals: Intl.PluralRules;
  lists: Intl.ListFormat;
}

function createLocale(lang: PageLanguage): Locale {
  return {
    lang,
    t: COUNTRY_PAGE_COPY[lang],
    regions: new Intl.DisplayNames([lang], { type: "region" }),
    numbers: new Intl.NumberFormat(lang),
    plurals: new Intl.PluralRules(lang),
    lists: new Intl.ListFormat(lang, { type: "conjunction" }),
  };
}

const LOCALES: Record<PageLanguage, Locale> = { en: createLocale("en"), fr: createLocale("fr") };

export function countryName(countryCode: string, lang: PageLanguage = "en") {
  try {
    return LOCALES[lang].regions.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

const SITE_NAME = "Open IDRO Directory";
const OG_LOCALES: Record<PageLanguage, string> = { en: "en_GB", fr: "fr_FR" };
const OTHER_LANGUAGE: Record<PageLanguage, PageLanguage> = { en: "fr", fr: "en" };

/**
 * The canonical URL of a country page in one language, built from the path
 * country alone: no search parameter, an English page without `?lang`.
 */
function countryPageUrl(origin: string, code: string, lang: PageLanguage) {
  const path = `${origin}/countries/${code.toLowerCase()}/`;
  return lang === "en" ? path : `${path}?lang=${lang}`;
}

/**
 * A `<script type="application/ld+json">` block for `data`. Every `<` is
 * escaped as `<`, which JSON reads back unchanged, so no value can close
 * the tag or open a comment; only this pre-escaped string is inserted raw.
 */
export function jsonLdScript(data: unknown) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return html`<script type="application/ld+json">
    ${raw(json)}
  </script>`;
}

/**
 * Server-rendered country page, in English by default or in French
 * (`?lang=fr`). Its head carries a description, the canonical URL of its
 * language, the `hreflang` alternates, Open Graph tags and JSON-LD
 * breadcrumbs, all built from the path country.
 */
export async function renderCountryPage(
  summary: CountrySummary,
  origin: string,
  lang: PageLanguage = "en",
) {
  const locale = LOCALES[lang];
  const { t } = locale;
  const code = summary.countryCode;
  const name = countryName(code, lang);
  const published = summary.coverage.status === "PUBLISHED";
  const title = `${name} (${code}) - ${SITE_NAME}`;
  const canonical = countryPageUrl(origin, code, lang);
  const other = OTHER_LANGUAGE[lang];
  const english = countryPageUrl(origin, code, "en");
  const coverage = coverageLine(summary, locale);
  const authorities = authorityNames(summary);
  const description = [
    t.meta.description(name),
    coverage,
    authorities.length > 0 ? t.meta.authorities(locale.lists.format(authorities)) : "",
  ]
    .filter(Boolean)
    .join(" ");
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: t.meta.home, item: `${origin}/` },
      { name: t.nav.countries, item: `${origin}/#pays` },
      { name, item: canonical },
    ].map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
  };

  const head = html`<meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="${english}" />
    <link rel="alternate" hreflang="fr" href="${countryPageUrl(origin, code, "fr")}" />
    <link rel="alternate" hreflang="x-default" href="${english}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:locale" content="${OG_LOCALES[lang]}" />
    <meta property="og:locale:alternate" content="${OG_LOCALES[other]}" />
    ${jsonLdScript(breadcrumbs)}`;

  const body = html`
    <header class="page-header">
      <p class="country-page-code">${t.eyebrow} &middot; ${code}</p>
      <h1 class="page-title">${name}</h1>
      <p class="page-subtitle">${coverage}</p>
      <p class="country-page-meta">
        <a href="${countryPageUrl(origin, code, other)}" hreflang="${other}" lang="${other}"
          >${t.meta.otherLanguage}</a
        >
      </p>
    </header>
    ${published ? searchSection(code, name, locale.t) : emptyState(summary, name, locale)}
    ${authoritiesSection(summary, locale)} ${coverageSection(summary, locale)}
    ${sourcesSection(summary, locale)} ${linksSection(summary, published, name, locale)}
  `;

  return page({
    lang,
    title,
    head,
    body,
    // Only a country with identifiers has a search to enhance.
    scripts: published,
  });
}

type SearchKey = keyof PageCopy["search"];

/**
 * The explorer's search, pinned to the page country. Hidden until
 * public/explorer.js reads the data attributes and unhides it, so the page
 * without JavaScript is the static content alone.
 */
function searchSection(code: string, name: string, copy: PageCopy) {
  const t = copy.search;
  const i18n = (key: SearchKey) => html`<span data-i18n="${key}">${t[key]}</span>`;
  const detailFact = (key: SearchKey, id: string) =>
    html`<div>
      <div class="meta-label" data-i18n="${key}">${t[key]}</div>
      <div class="meta-value" id="${id}"></div>
    </div>`;
  return html`
    <section
      class="section country-section country-search"
      aria-labelledby="search-title"
      data-fixed-country="${code}"
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
      <aside class="detail-panel" id="detail-panel" aria-label="${t.detailLabel}" hidden>
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

const ERROR_TITLES: Record<number, string> = {
  400: "Conflicting country",
  404: "Page not found",
  503: "Data temporarily unavailable",
};

/** Error pages stay in English, whatever `?lang` asked for. */
export async function renderErrorPage(status: number, message: string, requestId: string) {
  const title = ERROR_TITLES[status] ?? "Something went wrong";
  return page({
    lang: "en",
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

function coverageLine(summary: CountrySummary, locale: Locale) {
  const { t } = locale;
  const sourceCount = summary.sources.filter(
    (source) => source.countryObservations.total > 0,
  ).length;
  if (summary.coverage.status !== "PUBLISHED") return t.coverage.unpublished;
  const parties = summary.statistics.parties;
  const published = plural(locale, parties, t.coverage.published);
  return `${count(locale, parties, t.coverage.identifier)} ${published} ${count(locale, sourceCount, t.coverage.source)}.`;
}

function authorityNames(summary: CountrySummary) {
  return summary.authorities
    .map((authority) => authority.name)
    .filter((authorityName): authorityName is string => Boolean(authorityName));
}

function emptyState(summary: CountrySummary, name: string, locale: Locale) {
  const { t } = locale;
  const authorities = authorityNames(summary);
  const listed = summary.sources.filter((source) => source.publication.machineReadableUrl);
  // Only a list the directory has retrieved can be said to hold no identifiers.
  const retrieved = listed.filter((source) => source.health.lastSuccessfulAt).length;
  const state: EmptyState = {
    holder: authorities.length > 0 ? locale.lists.format(authorities) : t.empty.defaultHolder,
    // Verbs and pronouns agree with the number of authorities named.
    several: authorities.length > 1,
    name,
    kind:
      listed.length === 0
        ? "unlisted"
        : retrieved === 0
          ? "unretrieved"
          : retrieved < listed.length
            ? "partial"
            : "retrieved",
    lists: listed.length,
  };
  return html`
    <section class="trust-card country-empty" aria-labelledby="empty-title">
      <h2 id="empty-title">${t.empty.title}</h2>
      <p>${t.empty.explanation(state)} ${t.empty.ask(state.several)}</p>
    </section>
  `;
}

function authoritiesSection(summary: CountrySummary, locale: Locale) {
  const { t } = locale;
  const cards = summary.authorities.map(
    (authority) => html`
      <article class="trust-card">
        <h3>
          ${link(authority.homepageUrl, authority.name ?? authority.id ?? t.authorities.unnamed)}
        </h3>
        <dl class="meta-grid">
          ${fact(t.authorities.level, label(t.authorityLevel, authority.level) ?? t.values.unknown)}
          ${fact(t.authorities.jurisdictions, authority.jurisdictions.join(", "))}
          ${fact(
            t.authorities.sources,
            authority.sourceIds.length > 0 ? authority.sourceIds.join(", ") : t.values.noneFeminine,
          )}
        </dl>
        ${authority.notes ? html`<p>${authority.notes}</p>` : ""}
      </article>
    `,
  );
  return section(
    "authorities",
    t.authorities.title,
    cards.length > 0
      ? html`<div class="country-cards">${cards}</div>`
      : html`<p>${t.authorities.empty}</p>`,
  );
}

function coverageSection(summary: CountrySummary, locale: Locale) {
  const { t } = locale;
  const c = t.coverageSection;
  const { coverage, statistics } = summary;
  const none = t.values.none;
  return section(
    "coverage",
    c.title,
    html`
      <dl class="meta-grid country-facts">
        ${fact(c.status, coverage.status === "PUBLISHED" ? c.published : c.unpublished)}
        ${fact(
          c.declaredRoles,
          coverage.declaredRoles ? listOrNone(coverage.declaredRoles, none) : t.values.unknown,
        )}
        ${fact(c.publishedRoles, countsOrNone(locale, coverage.publishedRoles, none))}
        ${fact(c.identifiers, format(locale, statistics.parties))}
        ${fact(c.identifierRoles, format(locale, statistics.partyRoles))}
        ${fact(c.observations, format(locale, statistics.observations))}
        ${fact(c.conflicts, format(locale, statistics.conflicts))}
        ${fact(c.byStatus, countsOrNone(locale, statistics.countsByStatus, none, t.status))}
      </dl>
    `,
  );
}

function sourcesSection(summary: CountrySummary, locale: Locale) {
  const { t } = locale;
  const s = t.sources;
  const cards = summary.sources.map(
    (source) => html`
      <article class="trust-card">
        <h3>${source.name}</h3>
        <dl class="meta-grid">
          ${fact(s.sourceId, source.id)}
          ${fact(s.authority, source.authority.name ?? t.values.unknownFeminine)}
          ${fact(s.register, source.registry.url ? link(source.registry.url, source.registry.url) : t.values.unknown)}
          ${fact(
            s.observationType,
            label(t.observationType, source.registry.observationType) ?? t.values.unknown,
          )}
          ${fact(
            s.machineReadable,
            source.publication.machineReadableUrl
              ? link(source.publication.machineReadableUrl, source.publication.machineReadableUrl)
              : t.values.notPublished,
          )}
          ${fact(s.freshness, label(t.freshness, source.health.freshness) ?? t.values.unknownFeminine)}
          ${fact(s.lastSuccess, source.health.lastSuccessfulAt ? timestamp(source.health.lastSuccessfulAt) : t.values.never)}
          ${fact(
            s.observationsIn(summary.countryCode),
            source.countryObservations.total > 0
              ? `${format(locale, source.countryObservations.total)} (${counts(locale, source.countryObservations.byAuthorityLevel, t.authorityLevel)})`
              : t.values.noneFeminine,
          )}
        </dl>
      </article>
    `,
  );
  return section(
    "sources",
    s.title,
    cards.length > 0 ? html`<div class="country-cards">${cards}</div>` : html`<p>${s.empty}</p>`,
  );
}

function linksSection(summary: CountrySummary, published: boolean, name: string, locale: Locale) {
  const { t } = locale;
  const code = summary.countryCode;
  return section(
    "data",
    t.links.title,
    html`
      <ul class="country-links">
        ${
          published
            ? html`<li>
                <a class="text-link" href="/explore/?country=${code}">${t.links.explorer(name)}</a>
              </li>`
            : ""
        }
        <li>
          <a class="text-link" href="${API_PREFIX}/countries/${code}">${t.links.json}</a>
        </li>
      </ul>
      <p class="country-page-meta">${t.links.generated(timestamp(summary.datasetTimestamp))}</p>
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

function fact(name: string, value: string | Fragment) {
  return html`<div class="meta-item">
    <dt class="meta-label">${name}</dt>
    <dd class="meta-value">${value}</dd>
  </div>`;
}

/** Links only http(s) URLs; anything else is upstream data shown as text. */
function link(url: string | null, text: string) {
  if (url && /^https?:\/\//i.test(url)) {
    return html`<a href="${url}" rel="noreferrer">${text}</a>`;
  }
  return html`${text}`;
}

/** The label of an upstream enum value, the raw value when unlabelled, `null` when absent. */
function label(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) return null;
  return Object.hasOwn(labels, value) ? labels[value] : value;
}

function listOrNone(values: string[], none: string) {
  return values.length > 0 ? values.join(", ") : none;
}

function counts(
  locale: Locale,
  values: Record<string, number>,
  labels: Record<string, string> = {},
) {
  return Object.entries(values)
    .map(([key, value]) => `${label(labels, key)}${locale.t.values.colon}${format(locale, value)}`)
    .join(", ");
}

function countsOrNone(
  locale: Locale,
  values: Record<string, number>,
  none: string,
  labels: Record<string, string> = {},
) {
  return Object.keys(values).length > 0 ? counts(locale, values, labels) : none;
}

/** `one` or `other` for `value`; French counts 0 and 1 as singular. */
function plural(locale: Locale, value: number, forms: Plural) {
  return locale.plurals.select(value) === "one" ? forms.one : forms.other;
}

function count(locale: Locale, value: number, noun: Plural) {
  return `${format(locale, value)} ${plural(locale, value, noun)}`;
}

function format(locale: Locale, value: number) {
  return locale.numbers.format(value);
}

function timestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

async function page({
  lang,
  title,
  head = "",
  body,
  scripts = false,
}: {
  lang: PageLanguage;
  title: string;
  /** Page-specific `<head>` tags; error pages have none. */
  head?: Fragment | "";
  body: Fragment;
  scripts?: boolean;
}) {
  const { t } = LOCALES[lang];
  const document = await html`<!doctype html>
    <html lang="${lang}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        ${head}
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
                <a href="/explore/">${t.nav.explorer}</a>
                <a href="/#pays">${t.nav.countries}</a>
                <a href="/#sources">${t.nav.trust}</a>
                <a class="nav-muted" href="/docs">${t.nav.api}</a>
              </div>
            </div>
          </nav>
          <main class="content country-page">${body}</main>
          <footer class="site-footer">
            <div class="footer-inner">
              <div class="footer-about">
                <p>${t.disclaimer}</p>
              </div>
              <div class="footer-links">
                <div>
                  <a href="/explore/">${t.nav.explorer}</a>
                  <a href="/#pays">${t.nav.countries}</a>
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
