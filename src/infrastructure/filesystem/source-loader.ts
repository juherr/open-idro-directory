import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import {
  authorityDefinitionSchema,
  type AuthorityDefinition,
} from "../../domain/authority-definition.js";
import {
  resolveSourceDefinitions,
  type SourceDefinition,
  type SourceDescriptor,
} from "../../domain/source-definition.js";
import { parseSourceDescriptor } from "./legacy-source-descriptor.js";
import { fromRoot } from "./paths.js";

async function readYamlDir(...segments: string[]) {
  const dir = fromRoot(...segments);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".yaml")).sort();
  return Promise.all(
    files.map(async (file) => ({
      file,
      document: YAML.parse(await readFile(path.join(dir, file), "utf8")) as unknown,
    })),
  );
}

export async function loadAuthorityDefinitions(): Promise<AuthorityDefinition[]> {
  const documents = await readYamlDir("config", "authorities");
  const authorities: AuthorityDefinition[] = [];
  for (const { file, document } of documents) {
    const parsed = authorityDefinitionSchema.safeParse(document);
    if (!parsed.success) {
      throw new Error(`Invalid authority descriptor ${file}: ${parsed.error.message}`);
    }
    const duplicate = authorities.find((authority) => authority.id === parsed.data.id);
    if (duplicate) {
      throw new Error(`Duplicate authority id ${parsed.data.id} in ${file}.`);
    }
    authorities.push(parsed.data);
  }
  return authorities;
}

export async function loadSourceDescriptors(): Promise<SourceDescriptor[]> {
  const documents = await readYamlDir("config", "sources");
  const descriptors: SourceDescriptor[] = [];
  for (const { file, document } of documents) {
    const parsed = parseSourceDescriptor(document);
    if (!parsed.success) {
      throw new Error(`Invalid source descriptor ${file}: ${parsed.error.message}`);
    }
    const duplicate = descriptors.find((descriptor) => descriptor.id === parsed.data.id);
    if (duplicate) {
      throw new Error(`Duplicate source id ${parsed.data.id} in ${file}.`);
    }
    descriptors.push(parsed.data);
  }
  return descriptors;
}

export async function loadSourceDefinitions(): Promise<SourceDefinition[]> {
  const [descriptors, authorities] = await Promise.all([
    loadSourceDescriptors(),
    loadAuthorityDefinitions(),
  ]);
  return resolveSourceDefinitions(descriptors, authorities);
}

export async function loadSourceDefinition(sourceId: string): Promise<SourceDefinition> {
  const source = (await loadSourceDefinitions()).find((candidate) => candidate.id === sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return source;
}
