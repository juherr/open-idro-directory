import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { handleApiProxyRoute } from "../../proxy/api-proxy.ts";

// Rendered on demand: the API answers this path through the API binding.
export const prerender = false;

export const ALL: APIRoute = ({ request }) => handleApiProxyRoute(request, env.API);
