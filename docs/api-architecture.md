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
with a known IDRO but no published identifiers. The page is English only for
now.

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
derived from the dataset checksum and a page version, so a markup-only deploy
is not answered with a stale `304`. Every error, an HTML page or a JSON body,
carries `Cache-Control: no-store` and no ETag, so it is neither cached nor
revalidated into a `304`.
