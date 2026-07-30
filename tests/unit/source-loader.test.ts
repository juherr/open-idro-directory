import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

const descriptor = (id: string) => `
id: ${id}
name: Example register
authorityId: xx-authority
registry:
  url: https://example.org/register
  observationType: OFFICIAL_ASSIGNMENT
  supportedRoles: [CPO]
publication:
  connector: ${id}
  machineReadableUrl: null
  refreshSchedule: weekly
  enabled: false
  verifiedAt: null
reuse:
  status: unspecified
  legalBasis: null
  licence: null
  attributionNotice: null
  redistributionAllowed: null
  notes: null
`;

describe("loadSourceDescriptors", () => {
  it("rejects the same source id declared in two files", async () => {
    const root = await mkdtemp(join(tmpdir(), "open-idro-loader-"));
    try {
      const sources = join(root, "config", "sources");
      await import("node:fs/promises").then((fs) => fs.mkdir(sources, { recursive: true }));
      await writeFile(join(sources, "a-example.yaml"), descriptor("xx-example"));
      await writeFile(join(sources, "b-example.yaml"), descriptor("xx-example"));

      vi.resetModules();
      vi.doMock("../../src/infrastructure/filesystem/paths.js", () => ({
        fromRoot: (...segments: string[]) => join(root, ...segments),
      }));
      const { loadSourceDescriptors } =
        await import("../../src/infrastructure/filesystem/source-loader.js");

      await expect(loadSourceDescriptors()).rejects.toThrow(/Duplicate source id xx-example/);
    } finally {
      vi.doUnmock("../../src/infrastructure/filesystem/paths.js");
      vi.resetModules();
      await rm(root, { recursive: true, force: true });
    }
  });
});
