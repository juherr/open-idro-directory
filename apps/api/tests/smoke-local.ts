const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8787";

const checks = [
  "/",
  "/explore/",
  "/api/v1/health",
  "/api/v1/sources",
  "/api/v1/parties?limit=1",
  "/openapi.json",
];

for (const path of checks) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Smoke check failed for ${path}: ${response.status}`);
  }
}

const methodCheck = await fetch(`${baseUrl}/api/v1/parties`, { method: "POST" });
if (methodCheck.status !== 404 && methodCheck.status !== 405) {
  throw new Error(`Unexpected write endpoint response: ${methodCheck.status}`);
}

console.log(`Local API smoke checks passed against ${baseUrl}.`);

export {};
