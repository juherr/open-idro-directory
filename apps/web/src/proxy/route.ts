import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { handleApiProxyRoute } from "./api-proxy.ts";

/**
 * The handler of every page that forwards to the API (`/api/*`, `/docs`,
 * `/openapi.json`). Kept apart from `api-proxy.ts`, which unit tests import
 * outside the Workers runtime.
 */
export const proxyRoute: APIRoute = ({ request }) => handleApiProxyRoute(request, env.API);
