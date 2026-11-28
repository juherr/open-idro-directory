import { describe, expect, it } from "vitest";

import { siteTitle } from "../src/site.ts";

describe("web app bootstrap", () => {
  it("exposes the public site title", () => {
    expect(siteTitle).toBe("Open IDRO Directory");
  });
});
