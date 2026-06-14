import path from "node:path";

export const projectRoot = process.cwd();

export function fromRoot(...parts: string[]) {
  return path.join(projectRoot, ...parts);
}
