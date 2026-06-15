import { describe, expect, it } from "vitest";
import { buildImportBundle } from "./bundle.js";

describe("Cloudflare import bundle", () => {
  it("builds deterministic active-release rows from generated data", async () => {
    const bundle = await buildImportBundle();
    expect(bundle.release.record_count).toBe(bundle.observations.length);
    expect(bundle.manifest.files["observations.ndjson"]?.rows).toBe(bundle.observations.length);
    expect(bundle.parties.length).toBeGreaterThan(0);
    expect(bundle.observations[0]?.dataset_release_id).toBe(bundle.release.id);
  });
});
