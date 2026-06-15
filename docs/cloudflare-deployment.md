# Cloudflare Deployment

The API uses Cloudflare Workers and D1. Production deployment is controlled by `.github/workflows/deploy-api.yml` and requires GitHub environment protection.

Required secrets:

- `CLOUDFLARE_API_TOKEN`: narrowly scoped token for Workers deploy and D1 migrations/imports.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier.

Required environment variable:

- `API_BASE_URL`: deployed Worker URL used by smoke tests.

Before production, replace the placeholder `database_id` in `apps/api/wrangler.jsonc` with the real D1 database ID.

Local setup:

```bash
bun install
bun run api:migrate:local
bun run api:build-import
bun run api:import:local
bun run api:dev
```

The deploy workflow checks formatting, linting, type checking, tests, registry validation, import-bundle checksums, D1 migrations, D1 import, Worker deployment, and smoke tests.
