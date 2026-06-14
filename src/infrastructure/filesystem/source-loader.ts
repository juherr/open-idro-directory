import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { sourceDefinitionSchema, type SourceDefinition } from "../../domain/source-definition.js";
import { fromRoot } from "./paths.js";

export async function loadSourceDefinitions(): Promise<SourceDefinition[]> {
  const dir = fromRoot("config", "sources");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".yaml")).sort();
  const sources: SourceDefinition[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    const parsed = sourceDefinitionSchema.safeParse(YAML.parse(raw));
    if (!parsed.success) {
      throw new Error(`Invalid source descriptor ${file}: ${parsed.error.message}`);
    }
    sources.push(parsed.data);
  }
  return sources;
}

export async function loadSourceDefinition(sourceId: string): Promise<SourceDefinition> {
  const source = (await loadSourceDefinitions()).find((candidate) => candidate.id === sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return source;
}
