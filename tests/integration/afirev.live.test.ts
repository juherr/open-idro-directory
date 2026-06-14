import { describe, expect, it } from "vitest";
import { AfirevConnector } from "../../src/connectors/fr-afirev/afirev.connector.js";
import { loadSourceDefinition } from "../../src/infrastructure/filesystem/source-loader.js";

const maybe = process.env.AFIREV_LIVE_TEST === "1" ? describe : describe.skip;

maybe("AFIREV live connector", () => {
  it("fetches the current public JSON endpoint", async () => {
    const source = await loadSourceDefinition("fr-afirev");
    const connector = new AfirevConnector();
    const result = await connector.fetch({
      source,
      retrievedAt: new Date().toISOString(),
      userAgent: "global-emobility-id-registry-test/0.1",
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body).toContain('"data"');
  });
});
