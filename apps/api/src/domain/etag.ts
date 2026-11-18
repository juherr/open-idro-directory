export async function makeEtag(datasetChecksum: string, requestUrl: string) {
  const url = new URL(requestUrl);
  url.searchParams.sort();
  const input = `${datasetChecksum}:${url.pathname}:${url.searchParams.toString()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

/**
 * Evaluates an If-None-Match header against the current ETag (RFC 9110, section 13.1.2):
 * `*` matches, and each listed tag is compared weakly. Tags are matched as quoted strings,
 * so a comma inside a tag never splits it.
 */
export function ifNoneMatchMatches(header: string | undefined, etag: string) {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const opaque = stripWeak(etag);
  return (header.match(/(?:W\/)?"[^"]*"/g) ?? []).some((tag) => stripWeak(tag) === opaque);
}

function stripWeak(tag: string) {
  return tag.startsWith("W/") ? tag.slice(2) : tag;
}
