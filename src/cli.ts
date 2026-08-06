#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "@commander-js/extra-typings";
import { buildRegistry } from "./application/build-registry.js";
import { fetchSources, isFetchFailure } from "./application/fetch-sources.js";
import { validateGeneratedRegistry } from "./application/validate-registry.js";
import { diffAgainstGit, writeChangeReport } from "./application/change-report.js";
import { buildNonIdrrReports } from "./application/non-idrr-reports.js";
import { updateCountryRoleHistory } from "./application/stats-history.js";
import { refreshSourceMetadata } from "./application/refresh-source-metadata.js";
import type { SourceBuildResult } from "./domain/source-result.js";
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
      const outcomes = await fetchSources(
        sources,
        compactOptions({ sourceId: options.source, owner: options.owner }),
      );
      const failures = outcomes.filter(isFetchFailure);
      for (const failure of failures) {
        console.error(`Source ${failure.sourceId} could not be fetched: ${failure.error}`);
      }
      console.log(`Fetched ${outcomes.length - failures.length} of ${outcomes.length} source(s).`);
      // Nothing was retrieved, so the command did not do what it was asked to.
      if (outcomes.length > 0 && failures.length === outcomes.length) {
        throw new Error(`Every selected source failed to fetch.`);
      }
    }),
  );

program
  .command("build")
  .option("--source <sourceId>", "source id")
  .action(async (options) =>
    run(async () => {
      const sources = await loadSourceDefinitions();
      const result = await buildRegistry(sources, compactOptions({ sourceId: options.source }));
      const failures = reportSourceFailures(result.results);
      console.log(
        `Built ${result.records.length} normalized record(s), ${failures.length} source(s) failed.`,
      );
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
      const outcomes = await fetchSources(
        sources,
        compactOptions({ sourceId: options.source, owner: options.owner }),
      );
      const fetchErrors = Object.fromEntries(
        outcomes.filter(isFetchFailure).map((failure) => [failure.sourceId, failure.error]),
      );
      const result = await buildRegistry(sources, {
        ...compactOptions({ sourceId: options.source }),
        fetchErrors,
      });
      await validateGeneratedRegistry(sources);
      // A source that failed keeps its previous records, so the datasets are
      // published either way and the report is what makes the failure visible.
      const failures = reportSourceFailures(result.results);
      await writeChangeReport(
        options.source ? [options.source] : result.results.map((source) => source.sourceId),
        failures,
      );
      console.log(
        `Updated ${result.records.length} normalized record(s), ${failures.length} source(s) failed.`,
      );
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

program.command("sources").action(async () =>
  run(async () => {
    const sources = await loadSourceDefinitions();
    const summaries = await refreshSourceMetadata(sources);
    console.log(`Refreshed metadata for ${summaries.length} source(s) without rebuilding records.`);
  }),
);

program.command("stats:history").action(async () =>
  run(async () => {
    const rows = await updateCountryRoleHistory();
    console.log(`Updated country role history with ${rows.length} country row(s).`);
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

/** Prints the sources that failed and returns them for the change report. */
function reportSourceFailures(results: SourceBuildResult[]) {
  const failures = results
    .filter((result) => result.errors.length > 0)
    .map((result) => ({ sourceId: result.sourceId, error: result.latestError ?? "unknown" }));
  for (const failure of failures) {
    console.error(`Source ${failure.sourceId} failed: ${failure.error}`);
  }
  return failures;
}

function compactOptions<T extends Record<string, string | undefined>>(options: T) {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: string;
  };
}
