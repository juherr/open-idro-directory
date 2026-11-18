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
    ${published ? "" : emptyState(summary, name)} ${authoritiesSection(summary)}
    ${coverageSection(summary)} ${sourcesSection(summary)} ${linksSection(summary, published)}
  `;

  return page({
    title: `${name} (${code}) - Open IDRO Directory`,
    canonical: `${origin}/countries/${code.toLowerCase()}/`,
    body,
  });
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
  const authorities = summary.authorities.map((authority) => authority.name).filter(Boolean);
  const holder = authorities.length > 0 ? authorities.join(", ") : "The national authority";
  const listed = summary.sources.filter((source) => source.publication.machineReadableUrl);
  // Only a list the directory has retrieved can be said to hold no identifiers.
  const retrieved = listed.filter((source) => source.health.lastSuccessfulAt).length;
  // Plain strings, escaped when interpolated below.
  let explanation: string;
  if (listed.length === 0) {
    explanation =
      `${holder} manages e-mobility identifiers for ${name}, ` +
      "but publishes no machine-readable list of them, so this directory holds none.";
  } else if (retrieved === 0) {
    explanation =
      listed.length === 1
        ? `${holder} manages e-mobility identifiers for ${name} and publishes a machine-readable ` +
          "list, but this directory has not retrieved it yet, so it holds none."
        : `${holder} manages e-mobility identifiers for ${name} and publishes machine-readable ` +
          "lists, but this directory has not retrieved them yet, so it holds none.";
  } else if (retrieved < listed.length) {
    explanation =
      `${holder} manages e-mobility identifiers for ${name}. ` +
      `The lists retrieved so far hold no identifiers for ${name}, and others have not been ` +
      "retrieved yet, so this directory holds none.";
  } else {
    explanation =
      `${holder} manages e-mobility identifiers for ${name}. ` +
      (listed.length === 1
        ? `Its published list holds no identifiers for ${name} yet, so this directory holds none.`
        : `The published lists hold no identifiers for ${name} yet, so this directory holds none.`);
  }
  return html`
    <section class="trust-card country-empty" aria-labelledby="empty-title">
      <h2 id="empty-title">No published identifiers</h2>
      <p>${explanation} Ask the authority below to verify an identifier.</p>
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
}: {
  title: string;
  canonical?: string;
  body: Fragment;
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
      </body>
    </html>`;
  return document.toString();
}
