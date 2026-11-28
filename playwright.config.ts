// Browser suite of the public site. The scenarios target a base URL, not an
// app: `E2E_BASE_URL` points them at any running site; unset, the webServer
// below loads the fixture into a D1 of its own and serves the legacy
// frontend (apps/api) on a dedicated port.
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import {
  API_DIR,
  E2E_BUILD_DIR,
  E2E_D1_STATE_DIR,
  E2E_LOCAL_PORT,
  WRANGLER_BIN,
} from "./tests/e2e/support/paths.js";
import { shellQuote } from "./tests/e2e/support/shell.js";

const externalBaseUrl = process.env.E2E_BASE_URL;
const localBaseUrl = `http://127.0.0.1:${E2E_LOCAL_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: resolve(E2E_BUILD_DIR, "test-results"),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: resolve(E2E_BUILD_DIR, "report"), open: "never" }]],
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    // The explorer falls back to the browser language: pin it so a run reads
    // the same on every machine.
    locale: "en-US",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: [
            `node --import tsx ${shellQuote("../../tests/e2e/support/prepare-legacy.ts")}`,
            `${shellQuote(WRANGLER_BIN)} dev --ip 127.0.0.1 --port ${E2E_LOCAL_PORT} --persist-to ${shellQuote(E2E_D1_STATE_DIR)}`,
          ].join(" && "),
          cwd: API_DIR,
          url: `${localBaseUrl}/api/v1/health`,
          // A server already on the port is not the suite's: fail rather than
          // run the scenarios against unknown data.
          reuseExistingServer: false,
          timeout: 120_000,
          env: { WRANGLER_SEND_METRICS: "false" },
          stdout: "pipe",
        },
      }),
});
