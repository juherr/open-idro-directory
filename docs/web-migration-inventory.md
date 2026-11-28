# Web Migration Inventory

What the API Worker `open-idro-directory-api` serves to browsers before the
Astro migration (#137), read from the code at the start of #138. Later PRs
(#140 to #142) port this behaviour to `apps/web`; #143 checks parity before the
cutover. Decisions: [ADR 0001](decisions/0001-astro-web-frontend.md).

Paths are relative to `apps/api/`. `file:line` points at the code that states
each fact.

## Request dispatch

| Path                                       | Answered by                  | Source                                               |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------------- |
| `/api/*`, `/docs`, `/openapi.json`         | Hono app                     | `src/index.ts:14`, `src/index.ts:20-27`              |
| `/countries` and `/countries/*`            | Hono app (country pages)     | `src/index.ts:25`, `src/http/country-route.ts:11-13` |
| Any other path                             | Static assets from `public/` | `src/index.ts:15`, `wrangler.jsonc:6-10`             |
| Worker runs before assets on every request | `run_worker_first: true`     | `wrangler.jsonc:9`                                   |
| Custom domain                              | `idro.juherr.dev`            | `wrangler.jsonc:19-24`                               |

The repository sets no `_headers` file and no `not_found_handling` or
`html_handling` key (`wrangler.jsonc:6-10`), so static-asset headers, trailing
slash handling and the asset 404 are Cloudflare's defaults.

## Public routes

### Pages

| Route              | Kind                                                            | Source                                        |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------- |
| `/`                | Static `public/index.html`, scripts `shared.js` + `landing.js`  | `public/index.html:301-302`                   |
| `/explore/`        | Static `public/explore/index.html`, `shared.js` + `explorer.js` | `public/explore/index.html:292-293`           |
| `/countries/{lc}/` | SSR from D1, HTML                                               | `src/http/app.ts:254-283`                     |
| `/docs`            | HTML string, English only                                       | `src/http/app.ts:66`, `src/http/docs.ts:1-29` |
| `/openapi.json`    | JSON, server URL from the request origin                        | `src/http/app.ts:65`                          |

### Country page routing (`src/http/country-route.ts`)

| Request                                                               | Answer                                         | Source                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `/countries/{lc}/`, no `country` parameter                            | Render                                         | `country-route.ts:34-37`                                           |
| Uppercase code, missing trailing slash, or a `country` parameter      | `301` to `/countries/{lc}/`, other params kept | `country-route.ts:39-42`, `src/http/app.ts:257`                    |
| `country` naming another country (checked before any redirect)        | `400 CONFLICTING_COUNTRY`, HTML                | `country-route.ts:29-32`, `src/http/app.ts:258-264`                |
| Path not `/countries/[A-Za-z]{2}/?` (`/countries`, `/countries/fra/`) | `404 ROUTE_NOT_FOUND`, HTML                    | `country-route.ts:9`, `country-route.ts:26`, `src/http/app.ts:265` |
| Country with no source and no identifier                              | `404 COUNTRY_NOT_FOUND`, HTML                  | `src/http/app.ts:366-373`                                          |
| No active dataset                                                     | `503 NO_ACTIVE_DATASET`, HTML                  | `src/http/app.ts:351-355`, `src/http/app.ts:268`                   |

### API endpoints (`src/http/app.ts`)

`/api/v1` (68), `/health` (88), `/dataset` (97), `/parties` (101),
`/parties/:cc/:id` (112), `…/observations` (148), `…/conflicts` (162),
`/sources` (179), `/sources/:id` (185), `…/health` (193), `…/parties` (201),
`/conflicts` (215), `/stats` (226), `/countries/:code` (247),
`/resolve/:emobilityId` (285). Any other path under the Hono app gets a JSON
`404 ROUTE_NOT_FOUND` (305-307).

## Assets (`public/`)

| File                       | Used by                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `index.html`               | `/`                                                                                      |
| `explore/index.html`       | `/explore/`                                                                              |
| `styles.css` (1,593 lines) | every page (`public/index.html:18`, `src/http/pages/country-page.ts:574`)                |
| `shared.js`                | landing, explorer, country page search (`country-page.ts:285`)                           |
| `landing.js`               | landing                                                                                  |
| `explorer.js` (module)     | explorer, country page search (`country-page.ts:286`)                                    |
| `explorer-core.js`         | imported by `explorer.js` (`public/explorer.js:7`)                                       |
| `explorer-core.d.ts`       | declarations of `explorer-core.js` (`public/explorer-core.js:3`); served as an asset too |
| `assets/favicon.png`       | every page (`public/index.html:13`, `country-page.ts:573`)                               |
| `assets/logo.png`          | footer author link (`public/index.html:275`, `public/explore/index.html:201`)            |

Fonts: the landing page and the explorer load Bricolage Grotesque and Hanken
Grotesk from Google Fonts (`public/index.html:11-17`,
`public/explore/index.html:11-17`). Country pages do not
(`country-page.ts:568-575`).

## Response headers

Hono middleware adds to every Hono response: CORS `origin: *`, methods
`GET, HEAD, OPTIONS`, exposed `ETag`, `X-Dataset-Release`,
`X-Registry-Schema-Version`, `X-Request-Id` (`src/http/app.ts:46-55`), and
`X-Request-Id` plus `X-Registry-Schema-Version: 1.4.0` (`app.ts:57-63`,
`src/domain/constants.ts:3`).

| Route                                 | `Cache-Control`                                      | ETag                                     | `X-Dataset-Release` | `304`              |
| ------------------------------------- | ---------------------------------------------------- | ---------------------------------------- | ------------------- | ------------------ |
| `/api/v1`, `/api/v1/dataset`          | `public, max-age=300, stale-while-revalidate=3600`   | dataset validator + URL                  | yes                 | on `If-None-Match` |
| `/api/v1/health`                      | `public, max-age=60`                                 | none                                     | yes                 | no                 |
| Other `/api/v1/*` successes           | `public, max-age=3600, stale-while-revalidate=86400` | dataset validator + URL                  | yes                 | on `If-None-Match` |
| `/countries/{lc}/` success            | `public, max-age=3600, stale-while-revalidate=86400` | validator + `COUNTRY_PAGE_VERSION` + URL | yes                 | on `If-None-Match` |
| `/countries/*` `301`                  | not set                                              | none                                     | no                  | no                 |
| Any Hono error (JSON or country HTML) | `no-store`                                           | removed                                  | not guaranteed      | never              |
| `/docs`, `/openapi.json`              | not set                                              | none                                     | no                  | no                 |
| Static assets                         | Cloudflare default                                   | Cloudflare default                       | no                  | Cloudflare default |

Sources: cache values `src/domain/constants.ts:10-15`; dataset responses
`app.ts:377-392`; health `app.ts:88-95`; country page `app.ts:269-278`; `301`
`app.ts:257`; errors `app.ts:341-349`; `/docs` and `/openapi.json` `app.ts:65-66`.

- Dataset validator = `${release.id}:${release.dataset_checksum}`
  (`app.ts:398-400`). `makeEtag` hashes it with the path and the sorted query
  (`src/domain/etag.ts:1-10`), so `lang` and any unread parameter change the
  ETag.
- `COUNTRY_PAGE_VERSION` is `"4"` (`app.ts:332`); the country page ETag input
  is `validator:version` (`app.ts:276`).
- Headers are set after the handler has loaded its data, so an error never
  carries success cache headers (`app.ts:269-272`, `app.ts:384-387`).
- `If-None-Match` handles `*`, lists and weak tags (`etag.ts:12-25`).
- An error set after `X-Dataset-Release` keeps it: `respondWithError` resets
  only `Cache-Control` and `ETag` (`app.ts:344-346`).

Error bodies: the API answers `{ error: { code, message, details?, requestId } }`
(`src/http/errors.ts:14-26`); under `/countries` the error is an English HTML
page with its title, message and request id (`app.ts:347-348`,
`src/http/pages/country-page.ts:288-310`).

## SEO tags

| Page                | `<html lang>`            | Title                                   | Description                                                    | Canonical / hreflang | OG   | JSON-LD        |
| ------------------- | ------------------------ | --------------------------------------- | -------------------------------------------------------------- | -------------------- | ---- | -------------- |
| `/`                 | `fr`, then set by script | `Open IDRO Directory`                   | static, English (`index.html:7-10`)                            | none                 | none | none           |
| `/explore/`         | `fr`, then set by script | `Explorer - Open IDRO Directory`        | static, English (`explore/index.html:7-10`)                    | none                 | none | none           |
| `/countries/{lc}/`  | `en` or `fr`             | `{Name} ({CODE}) - Open IDRO Directory` | localized, coverage and authorities (`country-page.ts:96-102`) | yes                  | yes  | BreadcrumbList |
| Country error pages | `en`                     | `{Error title} - Open IDRO Directory`   | none                                                           | none                 | none | none           |
| `/docs`             | `en`                     | `Open IDRO Directory API`               | none                                                           | none                 | none | none           |

Static page sources: `public/index.html:2-6`, `public/explore/index.html:2-6`;
`html lang` is rewritten by `shared.js:98`, `landing.js:173`, `explorer.js:178`.
Country page head (`src/http/pages/country-page.ts:113-125`):

- canonical: `{origin}/countries/{lc}/` in English, `…?lang=fr` in French, no
  other parameter (`country-page.ts:57-60`, `country-page.ts:91`);
- `hreflang` `en`, `fr`, and `x-default` on the English URL (`:115-117`);
- `og:type website`, `og:site_name`, `og:title`, `og:description`, `og:url` =
  canonical, `og:locale` `en_GB`/`fr_FR` and the other as
  `og:locale:alternate` (`:50`, `:118-124`);
- JSON-LD `BreadcrumbList`: home `{origin}/`, countries `{origin}/#pays`, the
  page (`:103-111`); every `<` escaped (`:67-72`);
- a visible link to the other language (`:132-136`).

## FR/EN behaviour

| Page                    | Choice                                                                                         | Source                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Landing, explorer       | `localStorage["oid-lang"]`, else `fr` if any `navigator.languages` starts with `fr`, else `en` | `public/shared.js:92-105`                                                          |
| Landing, explorer       | `data-lang` buttons store the choice and re-render                                             | `public/index.html:54-55`, `shared.js:96-99`, `shared.js:194-207`                  |
| Country page            | `?lang=fr` is French, anything else English; errors always English                             | `src/http/pages/country-page-copy.ts:7-9`, `app.ts:279`, `country-page.ts:294-299` |
| Country page search     | follows `<html lang>`, ignores `oid-lang`, never writes it                                     | `public/explorer.js:17-25`, `public/explorer-core.js:24-34`                        |
| Country page search URL | keeps `lang=fr`, `q`, `role`, `status`; drops other parameters at load                         | `public/explorer-core.js:105-115`, `public/explorer.js:164-172`                    |
| Links to country pages  | add `?lang=fr` when the current page is French                                                 | `public/landing.js:273-276`, `public/explorer-core.js:19-43`                       |

## API endpoints consumed per page

| Page                | Endpoint                                                             | Source                                                    |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| Landing             | `/api/v1/stats?view=landing`, `/api/v1`                              | `public/landing.js:317-330`                               |
| Explorer            | `/api/v1/parties?country&role&status&q\|emobilityId&limit=25&cursor` | `public/explorer-core.js:90-103`, `explorer.js:282`       |
| Explorer            | `/api/v1/resolve/{id}`                                               | `public/explorer-core.js:117-121`, `explorer.js:364`      |
| Explorer            | `/api/v1/parties/{cc}/{id}` (roles of each row)                      | `public/explorer.js:300-306`                              |
| Explorer            | `/api/v1/parties/{cc}/{id}` and `…/observations` (detail)            | `public/explorer.js:459-470`                              |
| Explorer            | `/api/v1/sources`, `/api/v1/stats`                                   | `public/explorer.js:589`, `explorer.js:600`               |
| Country page (SSR)  | D1 directly, the same summary as `/api/v1/countries/:code`           | `src/http/app.ts:247-251`, `app.ts:270`, `app.ts:357-375` |
| Country page search | the explorer's calls, with `country` forced to the page              | `public/explorer-core.js:94-95`                           |

- The API base is `window.OPEN_IDRO_API_BASE` or the page origin
  (`public/shared.js:3`); every call sends `accept: application/json` and
  throws on a non-2xx status (`shared.js:128-134`).
- The API reads no `view` parameter (no match under `src/`); on the landing
  page it only changes the URL and so the ETag.
- The landing page falls back to bundled stats and root data when a call fails
  (`public/landing.js:1`, `landing.js:52`, `landing.js:325-328`).

## Feature baseline for #140 to #142

- **Layout (#140)**: same top bar, navigation (`/explore/`, `/#pays`,
  `/#sources`, `/docs`), footer, `styles.css` classes and favicon
  (`public/index.html:22-59`, `public/index.html:250-299`).
- **Landing (#140)**: hero search redirects to `/explore/?q=…` or `/explore/`
  (`landing.js:332-336`); popular chips (`landing.js:292-315`); live stats with
  fallback, re-rendered every 60 s without refetching (`landing.js:190`,
  `landing.js:341`); country grid from `countsByIdentifierCountry`, linking to
  country pages (`landing.js:215-238`); sections `#pays` and `#sources`
  (`public/index.html:145`, `public/index.html:158`).
- **Country pages (#141)**: routing, status codes and HTML errors above; cache
  and `304` rules above with the web ETag of ADR 0001; head tags above; body
  sections: header with the other-language link, search or empty state,
  authorities, coverage, sources, links to the explorer and the JSON
  (`country-page.ts:127-141`, `country-page.ts:453-470`); search shell hidden
  until `explorer.js` enhances it, scripts only for a published country
  (`country-page.ts:148-149`, `country-page.ts:169-173`).
- **Explorer (#142)**: URL state `q`, `country`, `role`, `status`
  (`explorer-core.js:80-87`); identifier queries resolved first
  (`explorer-core.js:117-121`); 25-row pages with cursor "load more"
  (`explorer-core.js:5`, `explorer-core.js:100-101`); stale responses ignored
  (`explorer.js:276-283`); API request line with copy and open JSON
  (`public/explore/index.html:96-102`); detail panel with observations
  (`explorer.js:458-470`); the context label links the selected country to its
  page (`explorer.js:241-255`); the foreign-identifier notice links a country
  only once the stats count identifiers for it (`explorer.js:344-348`,
  `explorer-core.js:45-54`).

Existing tests that pin this behaviour: `tests/country-page.test.ts`,
`tests/country-route.test.ts`, `tests/explorer-core.test.ts`,
`tests/shared-script.test.ts`, and the country page cases of `tests/api.test.ts`.
