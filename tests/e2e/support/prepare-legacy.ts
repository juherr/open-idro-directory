// Loads the browser-suite fixture into a local D1 of its own, apart from the
// `.wrangler/state` that `api:dev` uses, so a run never clobbers it. The
// Playwright webServer runs this, then `wrangler dev` on the same state.
import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildImportBundle,
  writeImportBundle,
} from "../../../packages/registry-import/src/bundle.js";
import { writeE2eDataset } from "../fixtures/dataset.js";
import { API_DIR, E2E_D1_STATE_DIR, E2E_FIXTURE_DIR, WRANGLER_BIN } from "./paths.js";

const dataDir = resolve(E2E_FIXTURE_DIR, "data");
const bundleDir = resolve(E2E_FIXTURE_DIR, "bundle");

function wrangler(...args: string[]) {
  execFileSync(WRANGLER_BIN, args, {
    cwd: API_DIR,
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
}

await rm(E2E_FIXTURE_DIR, { recursive: true, force: true });
await writeE2eDataset(dataDir);
const manifest = await writeImportBundle(await buildImportBundle({ dataDir }), {
  outputDir: bundleDir,
});
const d1 = ["open-idro-directory", "--local", "--persist-to", E2E_D1_STATE_DIR];
wrangler("d1", "migrations", "apply", ...d1);
wrangler("d1", "execute", ...d1, "--yes", "--file", resolve(bundleDir, "import.sql"));
console.log(`Loaded ${manifest.recordCount} fixture record(s) into ${E2E_D1_STATE_DIR}.`);
