import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

// Set by the `dev` script only. `astro build` never sees it, so the local API
// Worker is not bundled into the build output nor listed in its deploy config.
const withLocalApi = process.env.WEB_DEV_LOCAL_API === "1";

/**
 * Runs the API Worker in the same workerd process as the website, so the `API`
 * binding reaches this checkout's API (never another `wrangler dev` found in
 * the machine-wide dev registry) on the local D1 state `api:dev` uses. The
 * inspector port avoids `api:dev`'s default 9229.
 */
const localApiOptions = {
  auxiliaryWorkers: [{ configPath: "../api/wrangler.jsonc" }],
  persistState: { path: "../api/.wrangler/state" },
  inspectorPort: 9230,
};

export default defineConfig({
  output: "static",
  // No sessions: the adapter would otherwise provision a SESSION KV namespace.
  session: false,
  adapter: cloudflare({
    // No image transforms: the adapter would otherwise bind Cloudflare Images.
    imageService: "passthrough",
    ...(withLocalApi ? localApiOptions : {}),
  }),
});
