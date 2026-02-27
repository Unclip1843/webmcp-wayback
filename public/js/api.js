const BASE = "/api";

async function request(path, params = {}) {
  const url = new URL(path, window.location.origin);
  url.pathname = BASE + path;
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/** List all sites with summaries */
export function fetchSites() {
  return request("/sites");
}

/** Get full site detail */
export function fetchSite(siteId, version) {
  return request(`/sites/${siteId}`, { version });
}

/** Get site versions */
export function fetchVersions(siteId) {
  return request(`/sites/${siteId}/versions`);
}

/** Get site capabilities with optional filters */
export function fetchCapabilities(siteId, { type, q } = {}) {
  return request(`/sites/${siteId}/capabilities`, { type, q });
}

/** Get aggregate stats */
export function fetchStats() {
  return request("/stats");
}

/** Search across all sites */
export function searchCapabilities(q) {
  return request("/search", { q });
}
