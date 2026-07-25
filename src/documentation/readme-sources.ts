import type { SourceDefinition } from "../domain/source-definition.js";

export const SUPPORTED_SOURCES_START = "<!-- BEGIN GENERATED SUPPORTED SOURCES -->";
export const SUPPORTED_SOURCES_END = "<!-- END GENERATED SUPPORTED SOURCES -->";

interface SourcePresentation {
  id: string;
  coverage: string;
  mechanism: string;
}

interface PendingSourcePresentation {
  name: string;
  coverage: string;
  mechanism: string;
}

const SOURCE_PRESENTATIONS: SourcePresentation[] = [
  {
    id: "at-ladestellen",
    coverage: "Supported: 🇦🇹",
    mechanism: "Public JSON endpoint used by Ladestellen.at's admin UI",
  },
  {
    id: "fr-afirev",
    coverage: "Supported: 🇫🇷",
    mechanism: "Public JSON endpoint used by AFIREV's embedded directory",
  },
  {
    id: "benelux-idro",
    coverage: "Supported: 🇧🇪, 🇳🇱; 🇱🇺 via regional source",
    mechanism: "Public CSV export from the ID register",
  },
  {
    id: "hr-croidro",
    coverage: "Supported: 🇭🇷",
    mechanism: "Public CSV export from the ID register",
  },
  {
    id: "cy-ems",
    coverage: "IDRO known; list unavailable: 🇨🇾",
    mechanism: "Temporary EMS page; no identifier list found yet",
  },
  {
    id: "dk-fstyr",
    coverage: "Supported: 🇩🇰",
    mechanism: "Public HTML table from the IDRO registration page",
  },
  {
    id: "de-bdew",
    coverage: "Supported: 🇩🇪",
    mechanism: "Public paginated JSON endpoint",
  },
  {
    id: "fi-traficom",
    coverage: "Supported: 🇫🇮",
    mechanism: "Public HTML table from the AFIR ID page",
  },
  {
    id: "gr-electrokinisi",
    coverage: "Supported: 🇬🇷",
    mechanism: "Public HTML table from the ID-register page",
  },
  {
    id: "hu-idro",
    coverage: "Supported: 🇭🇺",
    mechanism: "Public HTML list from the members page",
  },
  {
    id: "ie-tii",
    coverage: "Supported: 🇮🇪",
    mechanism: "Public PDF register",
  },
  {
    id: "lv-lvceli",
    coverage: "Supported: 🇱🇻",
    mechanism: "Public Drupal JSON page with embedded HTML table",
  },
  {
    id: "lt-vialietuva",
    coverage: "Supported: 🇱🇹",
    mechanism: "Public OCPI locations endpoint for CPO identifiers",
  },
  {
    id: "pl-eipa",
    coverage: "Supported: 🇵🇱",
    mechanism: "Public CSV export from the registered entities list",
  },
  {
    id: "pt-mobie",
    coverage: "Supported: 🇵🇹",
    mechanism: "Public PDF register",
  },
  {
    id: "es-ripree",
    coverage: "Supported: 🇪🇸",
    mechanism: "Public XML export from the company register export page",
  },
  {
    id: "si-nap",
    coverage: "Supported: 🇸🇮",
    mechanism: "Public XLSX national repository from NAP",
  },
  {
    id: "ch-suisseenergie",
    coverage: "Supported: 🇨🇭 (Non-EU)",
    mechanism: "Public Gatsby page-data JSON endpoint",
  },
  {
    id: "se-energimyndigheten",
    coverage: "Supported: 🇸🇪",
    mechanism: "Public XLSX registers for CPO and EMSP identifiers",
  },
  {
    id: "gb-evroam",
    coverage: "Supported: 🇬🇧 (Non-EU)",
    mechanism: "Public JSON API with official GB and cross-register IE identifiers",
  },
];

const PENDING_SOURCES: PendingSourcePresentation[] = [
  { name: "Bulgaria", coverage: "Coming soon: 🇧🇬", mechanism: "Awaiting IDRR data" },
  { name: "Czechia", coverage: "Coming soon: 🇨🇿", mechanism: "Awaiting IDRR data" },
  { name: "Estonia", coverage: "Coming soon: 🇪🇪", mechanism: "Awaiting IDRR data" },
  { name: "Italy", coverage: "Coming soon: 🇮🇹", mechanism: "Awaiting IDRR data" },
  {
    name: "Luxembourg national IDRO",
    coverage: "Coming soon: 🇱🇺",
    mechanism: "Awaiting IDRR data",
  },
  { name: "Malta", coverage: "Coming soon: 🇲🇹", mechanism: "Awaiting IDRR data" },
  { name: "Romania", coverage: "Coming soon: 🇷🇴", mechanism: "Awaiting IDRR data" },
  { name: "Slovakia", coverage: "Coming soon: 🇸🇰", mechanism: "Awaiting IDRR data" },
];

export function renderSupportedSourcesTable(sources: SourceDefinition[]): string {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const configuredIds = new Set(SOURCE_PRESENTATIONS.map((presentation) => presentation.id));

  for (const source of sources) {
    if (!configuredIds.has(source.id)) {
      throw new Error(`Missing README presentation for source: ${source.id}`);
    }
  }

  const rows = SOURCE_PRESENTATIONS.map((presentation) => {
    const source = sourceById.get(presentation.id);
    if (!source) {
      throw new Error(`README presentation references an unknown source: ${presentation.id}`);
    }
    return tableRow(
      `${source.name} (\`${source.id}\`)`,
      presentation.coverage,
      presentation.mechanism,
      renderReuseBasis(source),
    );
  });

  rows.push(
    ...PENDING_SOURCES.map((source) =>
      tableRow(source.name, source.coverage, source.mechanism, "Not applicable - source pending"),
    ),
  );

  return [
    "<!-- prettier-ignore -->",
    "| Source or IDRR entry | Coverage status | Mechanism | Licence / reuse basis |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export function replaceSupportedSourcesTable(readme: string, sources: SourceDefinition[]): string {
  const bounds = findGeneratedSection(readme);
  return [
    readme.slice(0, bounds.start + SUPPORTED_SOURCES_START.length),
    "\n",
    renderSupportedSourcesTable(sources),
    "\n\n",
    readme.slice(bounds.end),
  ].join("");
}

export function extractSupportedSourcesTable(readme: string): string {
  const bounds = findGeneratedSection(readme);
  return readme.slice(bounds.start + SUPPORTED_SOURCES_START.length, bounds.end).trim();
}

function renderReuseBasis(source: SourceDefinition): string {
  switch (source.reuse.status) {
    case "licensed":
      return source.reuse.licence
        ? markdownLink(source.reuse.licence.name, source.reuse.licence.url)
        : "Licensed";
    case "statutory":
      return source.reuse.legalBasis
        ? `Statutory - ${markdownLink(source.reuse.legalBasis.name, source.reuse.legalBasis.url)}`
        : "Statutory";
    case "permission-granted":
      return "Permission granted";
    case "restricted":
      return "Restricted";
    case "unspecified":
      return source.verifiedAt
        ? `No explicit reuse terms identified (reviewed ${source.verifiedAt})`
        : "Undetermined";
  }
}

function tableRow(source: string, coverage: string, mechanism: string, reuse: string): string {
  return `| ${source} | ${coverage} | ${mechanism} | ${reuse} |`;
}

function markdownLink(label: string, url: string): string {
  return `[${label}](${url})`;
}

function findGeneratedSection(readme: string) {
  const start = readme.indexOf(SUPPORTED_SOURCES_START);
  const end = readme.indexOf(SUPPORTED_SOURCES_END);
  const hasSingleStart = start >= 0 && start === readme.lastIndexOf(SUPPORTED_SOURCES_START);
  const hasSingleEnd = end >= 0 && end === readme.lastIndexOf(SUPPORTED_SOURCES_END);

  if (!hasSingleStart || !hasSingleEnd || end <= start) {
    throw new Error("README must contain exactly one generated supported-sources section.");
  }

  return { start, end };
}
