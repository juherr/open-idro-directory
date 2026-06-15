# API Architecture

The public API is a read-only Cloudflare Worker backed by Cloudflare D1. Git remains the canonical data history: source descriptors, raw snapshots, normalized datasets, reports, schemas, and changes are produced in the repository first. D1 is a disposable read model rebuilt from the generated Git artifacts.

The Worker never fetches or scrapes upstream registries. The pipeline remains:

```text
IDRO and secondary sources -> GitHub data pipeline -> data/* -> D1 import bundle -> Worker API
```

The API exposes consolidated parties and source-specific observations. A party is a computed view keyed by `countryCode + partyId`; observations are source claims and are not destructively merged. Conflicts are diagnostics and do not decide which source is correct.

The implementation lives under `apps/api`. Shared schemas are exposed through `packages/registry-model`, and import-bundle generation lives in `packages/registry-import`.

Every response includes dataset metadata and the disclaimer that this project is not an issuing authority.
