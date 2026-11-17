import { createApp } from "./http/app.js";
import { isCountryPagePath } from "./http/country-route.js";

interface WorkerEnv {
  REGISTRY_DB: D1Database;
  ASSETS: Fetcher;
}

const app = createApp();

export default {
  fetch(request, env, executionContext) {
    const path = new URL(request.url).pathname;
    if (isWorkerRoute(path)) return app.fetch(request, env, executionContext);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;

/** Paths answered by the Worker; every other path is a static asset. */
function isWorkerRoute(path: string) {
  return (
    path.startsWith("/api/") ||
    path === "/docs" ||
    path === "/openapi.json" ||
    isCountryPagePath(path)
  );
}
