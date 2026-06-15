export function docsHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Open IDRO Directory API</title>
    <style>
      body { color: #111827; font-family: system-ui, sans-serif; line-height: 1.5; margin: 2rem auto; max-width: 880px; padding: 0 1rem; }
      code { background: #f3f4f6; border-radius: 4px; padding: 0.1rem 0.25rem; }
      pre { background: #111827; border-radius: 8px; color: #f9fafb; overflow: auto; padding: 1rem; }
    </style>
  </head>
  <body>
    <h1>Open IDRO Directory API</h1>
    <p><strong>Disclaimer:</strong> Open IDRO Directory is an independent aggregation project. It does not issue e-mobility identifiers and is not an authoritative source. Consumers must refer to the originating IDRO for legal, contractual, or operational verification.</p>
    <p>The API is read-only. It exposes the active Git-generated dataset imported into Cloudflare D1.</p>
    <h2>Endpoints</h2>
    <pre>GET /api/v1
GET /api/v1/parties?country=FR&amp;limit=50
GET /api/v1/parties/FR/ABC
GET /api/v1/resolve/FRABC
GET /api/v1/sources
GET /api/v1/stats
GET /openapi.json</pre>
    <p>Use cursor pagination through the <code>pagination.nextCursor</code> response field. OpenAPI is available at <a href="/openapi.json">/openapi.json</a>.</p>
  </body>
</html>`;
}
