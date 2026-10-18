// ImageKit adds a cache timestamp to URLs returned by its authenticated details API.
// Persist the canonical URL; transformations and arbitrary query parameters remain forbidden.
export function canonicalImagekitMediaUrl(value: unknown, endpointValue: string): URL | null {
  try {
    const url = new URL(String(value));
    const endpoint = new URL(endpointValue);
    const parameters = [...url.searchParams.entries()];
    if (url.protocol !== 'https:' || url.origin !== endpoint.origin || url.username || url.password || url.hash ||
      !url.pathname.startsWith(`${endpoint.pathname.replace(/\/$/, '')}/`) ||
      parameters.length > 1 || parameters.some(([key, timestamp]) => key !== 'updatedAt' || !/^\d{1,16}$/.test(timestamp))) return null;
    url.search = '';
    return url;
  } catch { return null; }
}
