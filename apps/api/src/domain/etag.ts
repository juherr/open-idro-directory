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
