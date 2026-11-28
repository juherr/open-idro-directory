# API Operations

Rollback does not require re-scraping sources. Git contains the canonical dataset history, and D1 keeps at least the active release plus the previous release.

Rollback steps:

1. Identify the previous retained `dataset_releases.id`.
2. Run `UPDATE active_dataset SET dataset_release_id = '<release-id>' WHERE singleton = 1;`.
3. Verify `/api/v1/health`, `/api/v1/dataset`, one known source, and one known party.
4. Redeploy a previous Worker version only if API code changed incompatibly.

Free-tier assumptions verified from Cloudflare documentation on 2026-06-15:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/):
  Workers Free has 100,000 requests per day, 10 ms CPU, 128 MB memory, 50
  subrequests per request, and 3 MB Worker size.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): D1 Free
  has 10 databases, 500 MB per database, 5 GB storage per account, 50 queries
  per Worker invocation, 100 bound parameters per query, and 30 second maximum
  SQL query duration.

Design implications:

- Use indexed exact lookups and bounded cursor pagination.
- Cap `limit` at 200.
- Avoid runtime scraping and dynamic export generation.
- Cache public GET responses with dataset-versioned ETags.

## Browser Suite

`bun run web:e2e` runs the Playwright scenarios of `tests/e2e/` in headless
Chromium. Playwright runs under Node, not Bun. Install the browser once per
machine with `npx playwright install chromium`.

Without `E2E_BASE_URL`, the Playwright `webServer` builds the site under test
itself, then stops it at the end of the run:

1. It deletes `build/e2e/fixture/` and writes the fixture of
   `tests/e2e/fixtures/dataset.ts` there.
2. It builds the D1 import bundle of that fixture with
   `packages/registry-import`.
3. It applies the migrations and the import to a local D1 persisted in
   `build/e2e/fixture/d1`.
4. It starts `wrangler dev` on `http://127.0.0.1:8788` against that state.

The run never reads `data/` and never writes to `build/cloudflare` or to the
`.wrangler/state` that `api:dev` uses. The port must be free: the suite
refuses to reuse a server it did not start.

```bash
bun run web:e2e                                  # whole suite
bun run web:e2e -- tests/e2e/explorer.spec.ts    # one file
bun run web:e2e -- -g "stays in France"          # one scenario
npx playwright show-report build/e2e/report      # last HTML report
```

`E2E_BASE_URL=<origin> bun run web:e2e` runs the same scenarios against a site
that is already running, for instance another frontend. The scenarios assert
fixture names and counts, so that site must serve the same fixture.

CI runs the suite in the `e2e` job of `.github/workflows/ci.yml`. When it
fails, the job uploads the HTML report and the traces as the
`playwright-report` artifact.

## Partial Source Failures

A registry that cannot be fetched or parsed no longer stops the run. The failing
source keeps the records it was last published with, is marked `stale` in
`data/sources.json` with the reported error and the date it last answered, and is
listed under "Failed sources" at the top of `build/change-summary.md` and of the
pull request body. The sources that answered are still published.

The run only fails when registry validation reports an error, or when every
selected source failed: the two cases where the published result cannot be
trusted.

A stale source is an outage to investigate, not an accepted state. Its records
keep their previous retrieval timestamps and grow older with every run.

## Reading The Change Summary

`build/change-summary.md` reports, per source, what the run changed and what it
found: `Unreadable values` counts the raw values no connector could read, and
`Cross-register listings` counts the identifiers the register publishes for a
country it does not cover, which are published as listings. Unreadable values
are zero for a healthy source; listings are a normal part of some registers. The
values themselves are listed in the per-source details block; the pull-request
body keeps the counts only, so it stays within GitHub's size limit.

A refused value never becomes a record, so nothing in the added/updated/removed
counts would otherwise mention it -- a register could start publishing unreadable
rows and the summary would report no change at all. Listings are records, but
the diff lines only show the ones that changed.

## Cross-Register Listings

`data/reports/out-of-jurisdiction.json` lists the cross-register listings the
published records hold: the identifiers each register publishes for a country
it does not cover, grouped by that register. Every group carries the
organisation behind the register and its landing page, and every identifier
names the registry appointed for its country, so a listing can be compared from
both ends. `firstDetectedAt` and `lastDetectedAt` are the earliest
`source.firstSeenAt` and the latest `source.lastSeenAt` of the identifier's
records in that register; an identifier listed under several roles appears
once.

The report follows the published records. A register that stops listing an
identifier drops it from `data/registry.*` and from the report. Only a full
build writes the report; a run restricted with `--source` leaves it as it was.
Entries recorded before foreign identifiers became listings stay in the
`outOfJurisdiction` bucket of `data/registry-invalid.json`, which no build adds
to any more.

A listing is not a finding against the identifier: the observing register does
not issue it, and the report says nothing about its standing with its issuer.

When raising one of these with a registry operator, describe the identifier and
the registers concerned, not the quality of the organisation's work.

## Source Metadata Only

Run `bun run directory sources` after changing source authority, provenance,
verification, or reuse configuration without fetching or rebuilding registry
records. The command preserves existing source health and retrieval timestamps,
and updates only `data/sources.json`.
