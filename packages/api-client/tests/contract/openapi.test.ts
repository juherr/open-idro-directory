import { describe, expect, it } from "vitest";

import { openApiDocument } from "../../../../apps/api/src/openapi/document.js";
import { ENDPOINTS, type EndpointDefinition } from "../../src/index.js";

interface OpenApiParameter {
  name: string;
  in: string;
}

type OpenApiPaths = Record<string, Record<string, { parameters?: OpenApiParameter[] } | undefined>>;

const paths = openApiDocument().paths as OpenApiPaths;

/**
 * Query parameters the API accepts (`partyListQuerySchema`) and the client sends, but the
 * OpenAPI document does not declare. Listed in `docs/web-migration-inventory.md`; the API
 * contract is not changed here.
 */
const KNOWN_QUERY_GAPS: Partial<Record<keyof typeof ENDPOINTS, readonly string[]>> = {
  parties: ["country", "role", "status", "q", "emobilityId", "limit", "cursor"],
};

const endpoints = Object.entries(ENDPOINTS) as Array<[keyof typeof ENDPOINTS, EndpointDefinition]>;

function operation(endpoint: EndpointDefinition) {
  return paths[endpoint.path]?.[endpoint.method.toLowerCase()];
}

function declared(endpoint: EndpointDefinition, location: "path" | "query") {
  return (operation(endpoint)?.parameters ?? [])
    .filter((parameter) => parameter.in === location)
    .map((parameter) => parameter.name);
}

describe("endpoint table against the OpenAPI document", () => {
  it.each(endpoints)("documents %s with its method and path", (_name, endpoint) => {
    expect(operation(endpoint)).toBeDefined();
  });

  it.each(endpoints)("documents the path parameters of %s", (_name, endpoint) => {
    const template = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => name);
    expect(declared(endpoint, "path")).toEqual(template);
  });

  it.each(endpoints)("documents every query parameter %s sends", (name, endpoint) => {
    const gaps = KNOWN_QUERY_GAPS[name] ?? [];
    const undocumented = endpoint.query.filter(
      (parameter) => !declared(endpoint, "query").includes(parameter),
    );
    expect(undocumented).toEqual(gaps);
  });

  it("keeps the known gaps to parameters the client sends and the document still omits", () => {
    expect(KNOWN_QUERY_GAPS).toEqual({
      parties: ["country", "role", "status", "q", "emobilityId", "limit", "cursor"],
    });
    for (const [name, gaps] of Object.entries(KNOWN_QUERY_GAPS)) {
      const endpoint = ENDPOINTS[name as keyof typeof ENDPOINTS];
      for (const gap of gaps) {
        expect(endpoint.query).toContain(gap);
        // Goes red once the document declares it: drop the gap then.
        expect(declared(endpoint, "query")).not.toContain(gap);
      }
    }
  });
});
