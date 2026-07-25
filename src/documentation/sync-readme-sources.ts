import { readFile, writeFile } from "node:fs/promises";
import { replaceSupportedSourcesTable } from "./readme-sources.js";
import { loadSourceDefinitions } from "../infrastructure/filesystem/source-loader.js";
import { fromRoot } from "../infrastructure/filesystem/paths.js";

const readmePath = fromRoot("README.md");
const [readme, sources] = await Promise.all([
  readFile(readmePath, "utf8"),
  loadSourceDefinitions(),
]);
const updated = replaceSupportedSourcesTable(readme, sources);

await writeFile(readmePath, updated);
console.log(`Synchronized ${sources.length} configured source(s) in README.md.`);
