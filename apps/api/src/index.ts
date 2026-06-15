import { createApp } from "./http/app.js";

interface WorkerEnv {
  REGISTRY_DB: D1Database;
  ASSETS: Fetcher;
}

const app = createApp();

export default {
  fetch(request, env, executionContext) {
    const path = new URL(request.url).pathname;
    if (isApiRoute(path)) return app.fetch(request, env, executionContext);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;

function isApiRoute(path: string) {
  return path.startsWith("/api/") || path === "/docs" || path === "/openapi.json";
}
