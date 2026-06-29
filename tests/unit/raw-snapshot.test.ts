import { describe, expect, it } from "vitest";
import { formatSnapshotBody } from "../../src/infrastructure/filesystem/raw-snapshot.js";

describe("formatSnapshotBody", () => {
  it("pretty-prints JSON bodies declared via the content type", () => {
    const formatted = formatSnapshotBody('{"data":[{"id":1}]}', "application/json; charset=utf-8");

    expect(formatted).toBe('{\n  "data": [\n    {\n      "id": 1\n    }\n  ]\n}\n');
  });

  it("pretty-prints JSON bodies when the content type is missing but the body looks like JSON", () => {
    expect(formatSnapshotBody("  [1,2]", null)).toBe("[\n  1,\n  2\n]\n");
  });

  it("preserves non-JSON bodies byte-for-byte", () => {
    const xml = "<root><item/></root>";
    expect(formatSnapshotBody(xml, "application/xml")).toBe(xml);

    const csv = "a,b\n1,2\n";
    expect(formatSnapshotBody(csv, null)).toBe(csv);
  });

  it("preserves malformed JSON rather than throwing", () => {
    const broken = '{"data": [';
    expect(formatSnapshotBody(broken, "application/json")).toBe(broken);
  });

  it("does not change the parsed content of a JSON body", () => {
    const original = '{"b":2,"a":[3,2,1]}';
    expect(JSON.parse(formatSnapshotBody(original, "application/json"))).toEqual(
      JSON.parse(original),
    );
  });
});
