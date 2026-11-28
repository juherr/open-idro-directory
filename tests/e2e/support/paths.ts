import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Everything a browser-suite run writes, gitignored. */
export const E2E_BUILD_DIR = resolve(rootDir, "build/e2e");
/** The fixture data, its D1 bundle and its D1 state, rebuilt on every run. */
export const E2E_FIXTURE_DIR = resolve(E2E_BUILD_DIR, "fixture");
export const E2E_D1_STATE_DIR = resolve(E2E_FIXTURE_DIR, "d1");
/** Not 8787, so a developer's `api:dev` is never mistaken for the suite's server. */
export const E2E_LOCAL_PORT = 8788;
