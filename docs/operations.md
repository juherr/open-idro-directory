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
