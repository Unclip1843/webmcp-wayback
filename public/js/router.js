const routes = [];
let currentCleanup = null;

/**
 * Register a route.
 * @param {string} pattern — e.g. "/site/:siteId/capabilities"
 * @param {(params: Record<string, string>) => void|(() => void)} handler
 */
export function route(pattern, handler) {
  const paramNames = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return "([^/]+)";
      }) +
      "$"
  );
  routes.push({ regex, paramNames, handler });
}

/** Navigate to a hash route */
export function navigate(path) {
  window.location.hash = "#" + path;
}

/** Get current path from hash */
export function currentPath() {
  return window.location.hash.slice(1) || "/";
}

/** Resolve current hash against routes */
function resolve() {
  const path = currentPath();

  if (typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }

  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      currentCleanup = r.handler(params) ?? null;
      return;
    }
  }

  // Fallback: go to dashboard
  if (path !== "/") {
    navigate("/");
  }
}

/** Start listening for hash changes */
export function startRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
