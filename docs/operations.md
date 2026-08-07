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

## Out-Of-Jurisdiction Findings

`data/reports/out-of-jurisdiction.json` lists the identifiers each register
publishes for a country it does not administer, grouped by the register to
contact. Every group carries the appointed organisation and its landing page,
and every identifier names the registry appointed for that country, so a finding
can be verified from both ends before it is raised.

The report describes the current run only. A register that corrects its export
drops out of it, while `data/registry-invalid.json` keeps the entry with an
older `lastDetectedAt` -- which is how a correction stays visible.

When raising one of these with a registry operator, describe the identifier and
the registers concerned, not the quality of the organisation's work.

## Source Metadata Only

Run `bun run directory sources` after changing source authority, provenance,
verification, or reuse configuration without fetching or rebuilding registry
records. The command preserves existing source health and retrieval timestamps,
and updates only `data/sources.json`.
