import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, readdir, stat, realpath } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

interface ServerOptions {
  port: number;
  dataDir: string;
}

export function startServer(opts: ServerOptions): void {
  const publicDir = resolve(import.meta.dirname, "..", "public");
  const dataDir = resolve(opts.dataDir);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${opts.port}`);
    const pathname = decodeURIComponent(url.pathname);

    res.setHeader("X-Content-Type-Options", "nosniff");

    try {
      if (pathname.startsWith("/api/")) {
        await handleApi(pathname, url, res, dataDir);
      } else {
        await serveStatic(pathname, res, publicDir);
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") {
        sendJson(res, 404, { error: "Not found" });
      } else {
        console.error("Server error:", err);
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  });

  server.listen(opts.port, () => {
    console.log(`webmcp-wayback running at http://localhost:${opts.port}`);
    console.log(`Reading data from: ${dataDir}`);
  });
}

async function handleApi(
  pathname: string,
  url: URL,
  res: ServerResponse,
  dataDir: string,
): Promise<void> {
  const sitesDir = join(dataDir, "sites");

  // GET /api/sites — list all sites with summary
  if (pathname === "/api/sites") {
    const sites = await listSites(sitesDir);
    sendJson(res, 200, sites);
    return;
  }

  // GET /api/sites/:siteId — full site detail (latest version)
  const siteMatch = pathname.match(/^\/api\/sites\/([a-zA-Z0-9_-]+)$/);
  if (siteMatch) {
    const siteId = siteMatch[1];
    const version = url.searchParams.get("version");
    const siteMap = await loadSiteMap(sitesDir, siteId, version ?? undefined);
    if (!siteMap) {
      sendJson(res, 404, { error: "Site not found" });
      return;
    }
    sendJson(res, 200, siteMap);
    return;
  }

  // GET /api/sites/:siteId/versions — list available versions
  const versionsMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/versions$/,
  );
  if (versionsMatch) {
    const siteId = versionsMatch[1];
    const versions = await listVersions(sitesDir, siteId);
    sendJson(res, 200, versions);
    return;
  }

  // GET /api/sites/:siteId/capabilities — capabilities with optional filters
  const capsMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/capabilities$/,
  );
  if (capsMatch) {
    const siteId = capsMatch[1];
    const siteMap = await loadSiteMap(sitesDir, siteId);
    if (!siteMap) {
      sendJson(res, 404, { error: "Site not found" });
      return;
    }
    let caps = siteMap.capabilities ?? [];
    const typeFilter = url.searchParams.get("type");
    if (typeFilter) {
      caps = caps.filter((c: { type: string }) => c.type === typeFilter);
    }
    const search = url.searchParams.get("q");
    if (search) {
      const q = search.toLowerCase();
      caps = caps.filter(
        (c: { name: string; description: string }) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      );
    }
    sendJson(res, 200, caps);
    return;
  }

  // GET /api/sites/:siteId/screenshot/:filename
  const screenshotMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/screenshot\/([a-zA-Z0-9._-]+)$/,
  );
  if (screenshotMatch) {
    const [, siteId, filename] = screenshotMatch;
    const version = url.searchParams.get("version");
    const vDir = await resolveVersionDir(
      sitesDir,
      siteId,
      version ?? undefined,
    );
    if (!vDir) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const screenshotPath = join(vDir, "raw", "screenshots", filename);
    await requireSafePath(screenshotPath, join(sitesDir, siteId));
    const data = await readFile(screenshotPath);
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(data);
    return;
  }

  // GET /api/stats — aggregate statistics
  if (pathname === "/api/stats") {
    const sites = await listSites(sitesDir);
    const totalCaps = sites.reduce(
      (sum: number, s: { capabilityCount: number }) => sum + s.capabilityCount,
      0,
    );
    const totalPages = sites.reduce(
      (sum: number, s: { pageCount: number }) => sum + s.pageCount,
      0,
    );
    sendJson(res, 200, {
      totalSites: sites.length,
      totalCapabilities: totalCaps,
      totalPages: totalPages,
    });
    return;
  }

  // GET /api/search?q=... — search across all sites
  if (pathname === "/api/search") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    if (!q) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }
    const sites = await listSitesWithMaps(sitesDir);
    const results: unknown[] = [];
    for (const { siteId, siteMap } of sites) {
      for (const cap of (siteMap as any).capabilities ?? []) {
        if (
          cap.name.toLowerCase().includes(q) ||
          cap.description.toLowerCase().includes(q)
        ) {
          results.push({ ...cap, siteId, siteUrl: siteMap.url });
        }
      }
    }
    sendJson(res, 200, results);
    return;
  }

  sendJson(res, 404, { error: "Unknown API endpoint" });
}

// --- Data reading helpers ---

async function listSites(sitesDir: string): Promise<
  Array<{
    id: string;
    url: string;
    title: string;
    description: string;
    capabilityCount: number;
    pageCount: number;
    apiEndpointCount: number;
    crawledAt: string;
    versions: number;
    typeDistribution: Record<string, number>;
  }>
> {
  let entries: string[];
  try {
    entries = await readdir(sitesDir);
  } catch {
    return [];
  }

  const sites = [];
  for (const entry of entries) {
    const siteMap = await loadSiteMap(sitesDir, entry);
    if (!siteMap) continue;

    const typeDistribution: Record<string, number> = {};
    for (const cap of siteMap.capabilities ?? []) {
      typeDistribution[cap.type] = (typeDistribution[cap.type] ?? 0) + 1;
    }

    const versions = await listVersions(sitesDir, entry);

    sites.push({
      id: siteMap.id ?? entry,
      url: siteMap.url ?? "",
      title: siteMap.title ?? entry,
      description: siteMap.description ?? "",
      capabilityCount: (siteMap.capabilities ?? []).length,
      pageCount: (siteMap.pages ?? []).length,
      apiEndpointCount: (siteMap.apiEndpoints ?? []).length,
      crawledAt: siteMap.crawledAt ?? "",
      versions: versions.length,
      typeDistribution,
    });
  }

  return sites;
}

async function listSitesWithMaps(
  sitesDir: string,
): Promise<Array<{ siteId: string; siteMap: Record<string, unknown> }>> {
  let entries: string[];
  try {
    entries = await readdir(sitesDir);
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    const siteMap = await loadSiteMap(sitesDir, entry);
    if (siteMap) {
      results.push({ siteId: entry, siteMap });
    }
  }
  return results;
}

async function listVersions(
  sitesDir: string,
  siteId: string,
): Promise<Array<{ version: number; crawledAt: string }>> {
  const versionDir = join(sitesDir, siteId, "versions");
  let entries: string[];
  try {
    entries = await readdir(versionDir);
  } catch {
    return [];
  }

  const versions = [];
  for (const entry of entries) {
    const match = entry.match(/^v(\d+)$/);
    if (!match) continue;
    const ver = parseInt(match[1], 10);
    const siteMap = await loadSiteMap(sitesDir, siteId, `v${ver}`);
    if (!siteMap) continue; // skip versions without analysis
    versions.push({
      version: ver,
      crawledAt: siteMap?.crawledAt ?? "",
    });
  }

  return versions.sort((a, b) => a.version - b.version);
}

async function resolveVersionDir(
  sitesDir: string,
  siteId: string,
  version?: string,
): Promise<string | null> {
  const siteDir = join(sitesDir, siteId);
  try {
    await stat(siteDir);
  } catch {
    return null;
  }

  if (version) {
    const vDir = join(siteDir, "versions", version);
    try {
      await stat(vDir);
      return vDir;
    } catch {
      return null;
    }
  }

  // Find latest version
  const versionsDir = join(siteDir, "versions");
  let entries: string[];
  try {
    entries = await readdir(versionsDir);
  } catch {
    return null;
  }

  let maxVer = 0;
  for (const entry of entries) {
    const match = entry.match(/^v(\d+)$/);
    if (match) {
      const v = parseInt(match[1], 10);
      if (v > maxVer) maxVer = v;
    }
  }

  if (maxVer === 0) return null;
  return join(versionsDir, `v${maxVer}`);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadSiteMap(
  sitesDir: string,
  siteId: string,
  version?: string,
): Promise<any> {
  if (version) {
    // Specific version requested
    const vDir = await resolveVersionDir(sitesDir, siteId, version);
    if (!vDir) return null;
    const analysisPath = join(vDir, "analysis", "sitemap.json");
    try {
      const raw = await readFile(analysisPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // No specific version — try versions in descending order to find one with analysis
  const versionsDir = join(sitesDir, siteId, "versions");
  let entries: string[];
  try {
    entries = await readdir(versionsDir);
  } catch {
    return null;
  }

  const versionNums = entries
    .map((e) => {
      const m = e.match(/^v(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((v) => v > 0)
    .sort((a, b) => b - a);

  for (const v of versionNums) {
    const analysisPath = join(versionsDir, `v${v}`, "analysis", "sitemap.json");
    try {
      const raw = await readFile(analysisPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

// --- Static file serving ---

async function serveStatic(
  pathname: string,
  res: ServerResponse,
  publicDir: string,
): Promise<void> {
  let filePath: string;
  if (pathname === "/") {
    filePath = join(publicDir, "index.html");
  } else {
    filePath = join(publicDir, pathname);
  }

  await requireSafePath(filePath, publicDir);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  } catch {
    // SPA fallback: serve index.html for unknown paths
    filePath = join(publicDir, "index.html");
  }

  const data = await readFile(filePath);
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(data);
}

async function requireSafePath(
  filePath: string,
  baseDir: string,
): Promise<void> {
  // Resolve the real path to prevent traversal via ../ or symlinks
  const resolvedBase = await realpath(baseDir);
  let resolvedFile: string;
  try {
    resolvedFile = await realpath(filePath);
  } catch (originalErr) {
    // File doesn't exist — check the unresolved path doesn't escape
    const normalized = resolve(filePath);
    if (!normalized.startsWith(resolvedBase)) {
      const err = new Error("Path traversal blocked") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    throw originalErr; // re-throw original ENOENT
  }
  if (!resolvedFile.startsWith(resolvedBase)) {
    const err = new Error("Path traversal blocked") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}
