# 0001. Astro web frontend on its own Worker

- Status: Accepted (2026-11-28)
- Issue: #138, epic #137
- Inventory of the frontend it replaces: [`docs/web-migration-inventory.md`](../web-migration-inventory.md)

## Context

The public website is served today by the API Worker `open-idro-directory-api`
(`apps/api`): static HTML and browser scripts from `apps/api/public`, and
country pages rendered by Hono from D1 under `/countries/*`. The Worker owns the
custom domain `idro.juherr.dev`. Epic #137 moves the website to its own
application without changing the API contract, the public URLs, the FR/EN
behaviour or the SEO tags, and with a tested rollback.

## Decision

### Application and Worker

- `apps/web`, package `@open-idro-directory/web`, built with Astro `^7.4` and
  the official `@astrojs/cloudflare` adapter `^14.4`, which targets Workers
  only. The root `wrangler` moves to `^4.125.0`, the adapter's peer range.
- Worker `open-idro-directory-web`, configured in `apps/web/wrangler.jsonc`
  with a service binding `API` to `open-idro-directory-api`, `workers_dev` on,
  and no `routes`, no custom domain and no deploy workflow until #143.
- The website reads the public API only, never D1. In SSR it calls the `API`
  binding through `import { env } from "cloudflare:workers"`; in the browser it
  fetches the same-origin `/api/v1`.
- No session KV and no Cloudflare Images binding: `session: false` and
  `imageService: "passthrough"` in `apps/web/astro.config.mjs`. The first
  deploy (#143) provisions nothing beyond the `API` binding and the assets.

### Rendering and language

- `output: "static"` by default. The landing page and the explorer are
  prerendered; country pages render on demand (`export const prerender = false`,
  #141).
- Astro i18n routing is off. Country pages keep `?lang=fr`; the landing page and
  the explorer keep choosing their language in the browser.
- No UI framework: native TypeScript in Astro `<script>` tags.

### TypeScript and the `.astro` files

- TypeScript 7 only. `web:typecheck` runs `astro sync && tsc`, so `.astro`
  files are not type-checked today: `astro check` refuses TypeScript 7.0 and
  asks for TypeScript 6.
- Logic lives in `.ts` modules, typed and unit-tested. `.astro` files hold
  markup and thin wiring only. This rule holds for the whole migration stack.
- Follow-up: #146 adopts `@astrojs/ts-content-mapper` once TypeScript 7.1 is GA.

### Same-origin API in development and preview

- On `workers.dev` and in `web:dev` the website Worker owns every path, so it
  forwards `/api/*`, `/docs` and `/openapi.json` to the `API` binding unchanged
  and returns the API response unchanged (`apps/web/src/proxy/api-proxy.ts`).
  A binding failure answers `502` with `Cache-Control: no-store` and no ETag.
- One exception: Astro's `security.checkOrigin` defaults to `true`
  (`astro/dist/core/config/schemas/defaults.js:45`) and its origin check runs
  before on-demand endpoints (`astro/dist/core/app/origin-check.js:72-79`), so
  a cross-origin `POST`, `PUT`, `PATCH` or `DELETE` with a form content type
  gets Astro's `403` instead of the API's answer. We keep the default: the API
  registers only `GET` routes and allows only `GET`, `HEAD` and `OPTIONS`
  (`apps/api/src/http/app.ts:50`), and the proxy only serves `web:dev` and the
  `workers.dev` preview.
- The proxy runs from on-demand catch-all endpoints
  (`apps/web/src/pages/api/[...path].ts`, `docs.ts`, `openapi.json.ts`), not
  from middleware: with prerendered routes only, the adapter builds an
  assets-only Worker in which middleware never runs for `/api/*`
  (`@astrojs/cloudflare` `dist/index.js:169`).
- In production the API's more specific routes win (see below), so the proxy
  is not on the request path.
- Service-binding calls "do not incur additional request fees"; the CPU time of
  both Workers is billed
  ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).

### Local development

- `bun run web:dev` runs the API as an auxiliary Worker in the same workerd
  process, on the D1 state of `api:dev` (`apps/api/.wrangler/state`), with the
  inspector on port 9230. `WEB_DEV_LOCAL_API=1`, set by the `dev` script only,
  enables it, so `astro build` never bundles the API.
- Never run two separate `wrangler dev` processes for this: the machine-wide dev
  registry resolved the `API` binding to another checkout's API during the
  probe.

### Cache

- Country pages (#141): page ETag = sha256 of the API ETag of
  `/api/v1/countries/:code`, `WEB_COUNTRY_PAGE_VERSION`, and the path with its
  sorted query. A markup change bumps `WEB_COUNTRY_PAGE_VERSION`. Errors are
  `no-store`, carry no ETag and are never answered `304`. No API change is
  needed: the API ETag already covers the release id and the dataset checksum.

## Domain ownership and rollback

Applied in #143, not before:

- The API keeps its custom domain `idro.juherr.dev`.
- The web Worker gets the route `idro.juherr.dev/*`.
- The API gets the more specific routes `idro.juherr.dev/api/*`,
  `idro.juherr.dev/docs` and `idro.juherr.dev/openapi.json`.

Cloudflare states that routes "take precedence if configured on the same
hostname" as a custom domain, and that "the most specific route pattern wins"
([Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)).

Consequences of this split:

- API traffic gains no hop and does not depend on the web Worker: a web outage
  never takes the API down.
- Rollback = delete the web `/*` route. The API serves the legacy frontend from
  `apps/api/public` again, with no API redeploy. The legacy frontend therefore
  stays in `apps/api` until the rollback window closes (#144).

## Deployment order

1. API first: deploy the API Worker with its specific routes.
2. Web second: deploy `open-idro-directory-web` and check it on `workers.dev`.
3. Routes last: attach `idro.juherr.dev/*` to the web Worker.

Rollback walks back the last step only.

## Consequences

- Two Workers to deploy and monitor; the web deploy workflow and the
  `workers.dev` preview arrive with #143. Until then CI builds the website and
  runs `wrangler deploy --dry-run` for both Workers, and merging deploys nothing.
- `bun run check` also runs `web:typecheck`, `web:test` and `web:build`.
- The `.astro` markup is not type-checked until #146.
- The legacy frontend in `apps/api` is frozen (fixes only) until #144 removes
  it.

## Alternatives

| Alternative                                                                 | Cost                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The web Worker takes the domain and forwards the whole API over the binding | CPU billed on both Workers for every API call; a web outage or a bad web deploy takes the public API down; rollback needs a redeploy or a domain reassignment |
| Pin TypeScript 6 and `@astrojs/check` to type-check `.astro` files          | A second TypeScript major in the workspace, about 70 lockfile lines                                                                                           |
| Proxy as Astro middleware                                                   | Never runs: with prerendered routes only the adapter builds an assets-only Worker                                                                             |
| Two `wrangler dev` processes (API and web) in development                   | The machine-wide dev registry can bind `API` to another checkout's API                                                                                        |
| Keep the session KV and Images bindings the adapter adds by default         | Two more resources to provision on the first deploy, both unused                                                                                              |
| Deploy the web Worker to `workers.dev` from #138                            | Every merge deploys before the migration is complete                                                                                                          |
