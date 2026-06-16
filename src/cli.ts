#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "@commander-js/extra-typings";
import { buildRegistry } from "./application/build-registry.js";
import { fetchSources } from "./application/fetch-sources.js";
import { validateGeneratedRegistry } from "./application/validate-registry.js";
import { diffAgainstGit, writeChangeReport } from "./application/change-report.js";
import { buildNonIdrrReports } from "./application/non-idrr-reports.js";
import { loadSourceDefinitions } from "./infrastructure/filesystem/source-loader.js";
import { fromRoot } from "./infrastructure/filesystem/paths.js";

const program = new Command();

program
  .name("directory")
  .description("Open IDRO Directory pipeline")
  .option("--verbose", "print verbose logs");

program
  .command("fetch")
  .option("--source <sourceId>", "source id")
  .option("--owner <owner>", "GitHub repository owner for User-Agent")
  .action(async (options) =>
    run(async () => {
      const sources = await loadSourceDefinitions();
      const results = await fetchSources(
        sources,
        compactOptions({ sourceId: options.source, owner: options.owner }),
      );
      console.log(`Fetched ${results.length} source(s).`);
    }),
  );

program
  .command("build")
  .option("--source <sourceId>", "source id")
  .action(async (options) =>
    run(async () => {
      const sources = await loadSourceDefinitions();
      const result = await buildRegistry(sources, compactOptions({ sourceId: options.source }));
      console.log(`Built ${result.records.length} normalized record(s).`);
    }),
  );

program.command("validate").action(async () =>
  run(async () => {
    const sources = await loadSourceDefinitions();
    const issues = await validateGeneratedRegistry(sources);
    console.log(
      `Registry validation passed with ${issues.filter((issue) => issue.severity === "warning").length} warning(s).`,
    );
  }),
);

program
  .command("update")
  .option("--source <sourceId>", "source id")
  .option("--owner <owner>", "GitHub repository owner for User-Agent")
  .action(async (options) =>
    run(async () => {
      const sources = await loadSourceDefinitions();
      await fetchSources(
        sources,
        compactOptions({ sourceId: options.source, owner: options.owner }),
      );
      const result = await buildRegistry(sources, compactOptions({ sourceId: options.source }));
      await validateGeneratedRegistry(sources);
      await writeChangeReport(result.results.map((source) => source.sourceId));
      console.log(`Updated ${result.records.length} normalized record(s).`);
    }),
  );

program
  .command("diff")
  .option("--source <sourceId>", "source id")
  .action(async (options) =>
    run(async () => {
      const diff = await diffAgainstGit(options.source);
      console.log(
        JSON.stringify(
          {
            previous: diff.previous,
            current: diff.current,
            added: diff.added.length,
            updated: diff.updated.length,
            removed: diff.removed.length,
            unchanged: diff.unchanged,
          },
          null,
          2,
        ),
      );
    }),
  );

program.command("stats").action(async () =>
  run(async () => {
    const stats = await readFile(fromRoot("data", "stats.json"), "utf8");
    console.log(stats.trim());
  }),
);

program.command("non-idrr:reports").action(async () =>
  run(async () => {
    const sources = await loadSourceDefinitions();
    const reports = await buildNonIdrrReports(sources);
    console.log(
      `Generated non-IDRR reports with ${reports.additions.length} addition(s), ${reports.conflicts.length} conflict(s), and ${reports.overlap.length} overlap record(s).`,
    );
  }),
);

await program.parseAsync();

async function run(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function compactOptions<T extends Record<string, string | undefined>>(options: T) {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: string;
  };
}
