# API Architecture

The public API is a read-only Cloudflare Worker backed by Cloudflare D1. Git remains the canonical data history: source descriptors, raw snapshots, normalized datasets, reports, schemas, and changes are produced in the repository first. D1 is a disposable read model rebuilt from the generated Git artifacts.

The Worker never fetches or scrapes upstream registries. The pipeline remains:

```text
IDRO and secondary sources -> GitHub data pipeline -> data/* -> D1 import bundle -> Worker API
```

The API exposes consolidated parties and source-specific observations. A party is a computed view keyed by `countryCode + partyId`; observations are source claims and are not destructively merged. Conflicts are diagnostics and do not decide which source is correct.

The implementation lives under `apps/api`. Shared schemas are exposed through `packages/registry-model`, and import-bundle generation lives in `packages/registry-import`.

Every response includes dataset metadata and the disclaimer that this project is not an issuing authority.

## Country Pages

The same Worker serves static assets from `apps/api/public` and, ahead of them,
a few routes of its own. `wrangler.jsonc` sets `run_worker_first`, and
`src/index.ts` hands `/api/*`, `/docs`, `/openapi.json` and `/countries/*` to
the Hono app. Every other path, the landing page and the generic explorer
`/explore/` included, goes to the asset server unchanged.

`/countries/{code}/` is a server-rendered HTML page built from the country
summary read model, so it is useful without JavaScript. It lists the country's
authorities, coverage, and sources, and explains the empty state of a country
with a known IDRO but no published identifiers.

The page is rendered in English by default and in French with `?lang=fr`;
`?lang=en` is English too, and any other value falls back to English rather
than failing. Error pages stay in English. Each language has its own canonical
URL, built from the path country alone and never carrying the search
parameters (`q`, `role`, `status`) or an unknown `lang`: `/countries/fr/` for
English and `/countries/fr/?lang=fr` for French. The head lists both as
`hreflang` alternates, with the English URL as `x-default`, and carries a
localized description, Open Graph tags whose `og:url` is the canonical URL,
and JSON-LD breadcrumbs. A link on the page switches to the other language.
The ETag covers the query string, `lang` included, so a page in one language
is never answered with a `304` validated by the other.

The path country is the source of truth:

- The canonical URL is lowercase with a trailing slash. `/countries/FR/` and
  `/countries/fr` answer `301` to `/countries/fr/`.
- A `country` query parameter naming the same country is redundant and is
  dropped by a `301`. Other query parameters are kept.
- A `country` query parameter naming another country answers `400`, before any
  redirect.
- A path that is not `/countries/{two letters}/`, or a country the directory
  does not know, answers `404`.

Errors under `/countries/` are HTML pages; the API keeps its JSON error body.
A rendered page carries `Cache-Control`, `X-Dataset-Release`, and an ETag
derived from the dataset release, its checksum and a page version, so neither a
new release nor a markup-only deploy is answered with a stale `304`. Every error, an HTML page or a JSON body,
carries `Cache-Control: no-store` and no ETag, so it is neither cached nor
revalidated into a `304`.
