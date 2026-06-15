import { Command } from "@commander-js/extra-typings";
import { verifyImportBundle, writeImportBundle } from "./bundle.js";

const program = new Command();

program.name("registry-import").description("Build and verify Cloudflare D1 import bundles");

program.command("build").action(async () => {
  const manifest = await writeImportBundle();
  console.log(
    `Built Cloudflare import bundle ${manifest.datasetReleaseId} with ${manifest.recordCount} observation(s).`,
  );
});

program.command("verify").action(async () => {
  const manifest = await verifyImportBundle();
  console.log(`Verified Cloudflare import bundle ${manifest.datasetReleaseId}.`);
});

await program.parseAsync();
