// Bindings declared in wrangler.jsonc, read through `env` from
// "cloudflare:workers". The website reads the API only, never D1.
declare namespace Cloudflare {
  interface Env {
    API: Fetcher;
  }
}
