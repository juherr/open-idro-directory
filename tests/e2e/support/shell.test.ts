import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { shellQuote } from "./shell.js";

// What a POSIX shell reads back from the quoted word.
function throughShell(value: string) {
  return execFileSync("sh", ["-c", `printf '%s' ${shellQuote(value)}`], { encoding: "utf8" });
}

describe("shellQuote", () => {
  it.each([
    ["a plain path", "/repo/node_modules/.bin/wrangler"],
    ["a path with spaces", "/Users/me/My Projects/repo/build/e2e/fixture/d1"],
    ["a single quote", "/Users/me/O'Brien/repo"],
    ["expansion characters", "/tmp/$HOME/`id`/$(id)/*"],
  ])("keeps %s as one literal word", (_, value) => {
    expect(throughShell(value)).toBe(value);
  });

  it("wraps the value in single quotes", () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });
});
