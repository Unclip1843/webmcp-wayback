import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile, readdir, stat, realpath } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { search, rebuildIndex } from "./search-index.js";
import { rewriteHtml, generateStructureView } from "./mirror.js";

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
        await handleApi(pathname, url, req, res, dataDir);
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
  req: IncomingMessage,
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

  // GET /api/sites/:siteId/screenshots — list screenshots for a version
  const screenshotsListMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/screenshots$/,
  );
  if (screenshotsListMatch) {
    const siteId = screenshotsListMatch[1];
    const version = url.searchParams.get("version");
    const vDir = await resolveVersionDir(
      sitesDir,
      siteId,
      version ?? undefined,
    );
    if (!vDir) {
      sendJson(res, 200, { version: null, pages: [] });
      return;
    }
    const ssDir = join(vDir, "raw", "screenshots");
    let files: string[];
    try {
      files = await readdir(ssDir);
    } catch {
      sendJson(res, 200, { version: version ?? "latest", pages: [] });
      return;
    }
    // Load playwright.json to get page URLs
    let pageUrls: string[] = [];
    try {
      const pwRaw = await readFile(
        join(vDir, "raw", "playwright.json"),
        "utf-8",
      );
      const pwData = JSON.parse(pwRaw);
      pageUrls = (pwData.snapshots ?? []).map(
        (s: { url: string }) => s.url ?? "",
      );
    } catch {
      // no playwright data
    }
    const pages = files
      .filter((f) => f.match(/^\d+\.png$/))
      .map((f) => {
        const idx = parseInt(f.replace(".png", ""), 10);
        return {
          index: idx,
          url: pageUrls[idx] ?? "",
          screenshotUrl: `/api/sites/${siteId}/screenshot/${f}?version=${version ?? ""}`,
        };
      })
      .sort((a, b) => a.index - b.index);
    sendJson(res, 200, { version: version ?? "latest", pages });
    return;
  }

  // GET /api/sites/:siteId/screenshots/:version/:index.png — serve screenshot binary
  const screenshotBinMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/screenshots\/(v\d+)\/(\d+)\.png$/,
  );
  if (screenshotBinMatch) {
    const [, siteId, version, index] = screenshotBinMatch;
    if (!VERSION_RE.test(version)) {
      sendJson(res, 400, { error: "Invalid version" });
      return;
    }
    const vDir = await resolveVersionDir(sitesDir, siteId, version);
    if (!vDir) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const screenshotPath = join(vDir, "raw", "screenshots", `${index}.png`);
    await requireSafePath(screenshotPath, join(sitesDir, siteId));
    const data = await readFile(screenshotPath);
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    });
    res.end(data);
    return;
  }

  // GET /api/sites/:siteId/timeline — version metadata for timeline
  const timelineMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/timeline$/,
  );
  if (timelineMatch) {
    const siteId = timelineMatch[1];
    const versions = await listVersions(sitesDir, siteId);
    const timeline = [];
    for (const v of versions) {
      const vDir = join(sitesDir, siteId, "versions", `v${v.version}`);
      let pageCount = 0;
      let capabilityCount = 0;
      let screenshotCount = 0;
      let htmlPageCount = 0;
      try {
        const siteMap = await loadSiteMap(sitesDir, siteId, `v${v.version}`);
        if (siteMap) {
          pageCount = (siteMap.pages ?? []).length;
          capabilityCount = (siteMap.capabilities ?? []).length;
        }
      } catch {
        /* skip */
      }
      try {
        const ssFiles = await readdir(join(vDir, "raw", "screenshots"));
        screenshotCount = ssFiles.filter((f: string) =>
          f.endsWith(".png"),
        ).length;
      } catch {
        /* no screenshots */
      }
      try {
        const htmlFiles = await readdir(join(vDir, "raw", "html-pages"));
        htmlPageCount = htmlFiles.filter((f: string) =>
          f.endsWith(".html"),
        ).length;
      } catch {
        /* no html pages */
      }
      timeline.push({
        version: v.version,
        date: v.crawledAt,
        pageCount,
        capabilityCount,
        screenshotCount,
        htmlPageCount,
      });
    }
    sendJson(res, 200, timeline);
    return;
  }

  // GET /api/analytics/overview — aggregate analytics
  if (pathname === "/api/analytics/overview") {
    const sites = await listSites(sitesDir);
    const totalCaps = sites.reduce((s, site) => s + site.capabilityCount, 0);
    const totalPages = sites.reduce((s, site) => s + site.pageCount, 0);
    let totalVersions = 0;
    let totalScreenshots = 0;
    const capsByType: Record<string, number> = {};
    const recentCrawls: Array<{
      siteId: string;
      version: number;
      date: string;
    }> = [];

    for (const site of sites) {
      totalVersions += site.versions;
      for (const [type, count] of Object.entries(site.typeDistribution)) {
        capsByType[type] = (capsByType[type] ?? 0) + count;
      }
      const versions = await listVersions(sitesDir, site.id);
      for (const v of versions) {
        try {
          const ssDir = join(
            sitesDir,
            site.id,
            "versions",
            `v${v.version}`,
            "raw",
            "screenshots",
          );
          const files = await readdir(ssDir);
          totalScreenshots += files.filter((f: string) =>
            f.endsWith(".png"),
          ).length;
        } catch {
          /* skip */
        }
        recentCrawls.push({
          siteId: site.id,
          version: v.version,
          date: v.crawledAt,
        });
      }
    }

    recentCrawls.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    sendJson(res, 200, {
      totalSites: sites.length,
      totalCapabilities: totalCaps,
      totalVersions,
      totalPages,
      totalScreenshots,
      capsByType,
      sitesByCapCount: sites
        .map((s) => ({ id: s.id, title: s.title, count: s.capabilityCount }))
        .sort((a, b) => b.count - a.count),
      recentCrawls: recentCrawls.slice(0, 10),
    });
    return;
  }

  // GET /api/sites/:siteId/analytics — per-site analytics
  const siteAnalyticsMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/analytics$/,
  );
  if (siteAnalyticsMatch) {
    const siteId = siteAnalyticsMatch[1];
    const versions = await listVersions(sitesDir, siteId);
    const capsOverTime: Array<{
      version: number;
      date: string;
      count: number;
      types: Record<string, number>;
    }> = [];
    const pagesOverTime: Array<{ version: number; count: number }> = [];

    for (const v of versions) {
      const siteMap = await loadSiteMap(sitesDir, siteId, `v${v.version}`);
      if (!siteMap) continue;
      const caps = siteMap.capabilities ?? [];
      const types: Record<string, number> = {};
      for (const c of caps) {
        types[c.type] = (types[c.type] ?? 0) + 1;
      }
      capsOverTime.push({
        version: v.version,
        date: v.crawledAt,
        count: caps.length,
        types,
      });
      pagesOverTime.push({
        version: v.version,
        count: (siteMap.pages ?? []).length,
      });
    }

    // Compute diffs between adjacent versions
    const versionDiffs: Array<{
      from: number;
      to: number;
      added: number;
      removed: number;
    }> = [];
    for (let i = 1; i < capsOverTime.length; i++) {
      const prev = capsOverTime[i - 1];
      const curr = capsOverTime[i];
      versionDiffs.push({
        from: prev.version,
        to: curr.version,
        added: Math.max(0, curr.count - prev.count),
        removed: Math.max(0, prev.count - curr.count),
      });
    }

    sendJson(res, 200, { capsOverTime, pagesOverTime, versionDiffs });
    return;
  }

  // GET /api/sites/:siteId/network — categorized network requests
  const networkMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/network$/,
  );
  if (networkMatch) {
    const siteId = networkMatch[1];
    const version = url.searchParams.get("version");
    const vDir = await resolveVersionDir(
      sitesDir,
      siteId,
      version ?? undefined,
    );
    if (!vDir) {
      sendJson(res, 200, { apis: [], resources: [], thirdParty: [] });
      return;
    }
    try {
      const raw = await readFile(join(vDir, "raw", "network.json"), "utf-8");
      const data = JSON.parse(raw);
      const requests = data.requests ?? [];
      // Get site URL for origin comparison
      const siteMap = await loadSiteMap(sitesDir, siteId);
      let siteOrigin = "";
      try {
        if (siteMap?.url) siteOrigin = new URL(siteMap.url).origin;
      } catch {
        /* skip */
      }

      const apis: typeof requests = [];
      const resources: typeof requests = [];
      const thirdParty: typeof requests = [];

      for (const req of requests) {
        const entry = {
          url: req.url ?? "",
          method: req.method ?? "GET",
          status: req.responseStatus ?? 0,
          contentType: req.responseContentType ?? "",
          size: req.responseSize ?? 0,
          type: req.type ?? "",
        };
        let reqOrigin = "";
        try {
          reqOrigin = new URL(entry.url).origin;
        } catch {
          /* skip */
        }
        const isThirdParty =
          siteOrigin && reqOrigin && reqOrigin !== siteOrigin;

        if (isThirdParty) {
          thirdParty.push(entry);
        } else if (
          entry.contentType.includes("json") ||
          entry.type === "xhr" ||
          entry.type === "fetch" ||
          entry.url.includes("/api/")
        ) {
          apis.push(entry);
        } else {
          resources.push(entry);
        }
      }
      sendJson(res, 200, { apis, resources, thirdParty });
    } catch {
      sendJson(res, 200, { apis: [], resources: [], thirdParty: [] });
    }
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

  // GET /api/search?q=... — indexed search across all sites
  if (pathname === "/api/search") {
    const q = url.searchParams.get("q") ?? "";
    if (!q) {
      sendJson(res, 400, { error: "Missing q parameter" });
      return;
    }
    const result = await search(dataDir, {
      q,
      type: url.searchParams.get("type") ?? undefined,
      site: url.searchParams.get("site") ?? undefined,
      auth: url.searchParams.get("auth") ?? undefined,
      urlPattern:
        (url.searchParams.get("urlPattern") ?? "").slice(0, 200) || undefined,
      limit: Math.max(
        1,
        parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
      ),
      offset: Math.max(
        0,
        parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
      ),
    });
    sendJson(res, 200, result);
    return;
  }

  // POST /api/search/rebuild — rebuild search index
  if (pathname === "/api/search/rebuild" && req.method === "POST") {
    const result = await rebuildIndex(dataDir);
    sendJson(res, 200, { rebuilt: true, ...result });
    return;
  }

  // GET /api/sites/:siteId/mirror/index — list captured HTML pages
  const mirrorIndexMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/mirror\/index$/,
  );
  if (mirrorIndexMatch) {
    const siteId = mirrorIndexMatch[1]!;
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
    const indexPath = join(vDir, "raw", "html-index.json");
    try {
      const raw = await readFile(indexPath, "utf-8");
      sendJson(res, 200, JSON.parse(raw));
    } catch {
      sendJson(res, 200, []);
    }
    return;
  }

  // GET /api/sites/:siteId/mirror/:pageIndex — serve rewritten HTML or structure view
  const mirrorPageMatch = pathname.match(
    /^\/api\/sites\/([a-zA-Z0-9_-]+)\/mirror\/(\d+)$/,
  );
  if (mirrorPageMatch) {
    const siteId = mirrorPageMatch[1]!;
    const pageIndex = mirrorPageMatch[2]!;
    const mode = url.searchParams.get("mode") ?? "full";
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

    if (mode === "structure") {
      // Load playwright snapshot for this page
      const pwPath = join(vDir, "raw", "playwright.json");
      try {
        const pwRaw = await readFile(pwPath, "utf-8");
        const pwData = JSON.parse(pwRaw);
        const idx = parseInt(pageIndex, 10);
        // For Playwright pages (index < 1000), use directly
        // For Firecrawl pages (index >= 1000), no structure available
        if (idx >= 1000) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
          });
          res.end(
            "<html><body style='color:#888;padding:2rem;font-family:sans-serif'>" +
              "<p>Structure view not available for Firecrawl-captured pages.</p></body></html>",
          );
          return;
        }
        const snapshot = pwData.snapshots?.[idx];
        if (!snapshot) {
          sendJson(res, 404, { error: "Page not found" });
          return;
        }
        const html = generateStructureView(snapshot);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
        });
        res.end(html);
      } catch {
        sendJson(res, 404, { error: "Playwright data not found" });
      }
      return;
    }

    // Full mirror mode
    const htmlPath = join(vDir, "raw", "html-pages", `${pageIndex}.html`);
    await requireSafePath(htmlPath, join(sitesDir, siteId));

    const MAX_MIRROR_SIZE = 10 * 1024 * 1024;
    let rawHtml: Buffer;
    try {
      rawHtml = await readFile(htmlPath);
    } catch {
      sendJson(res, 404, { error: "HTML page not found" });
      return;
    }

    if (rawHtml.length > MAX_MIRROR_SIZE) {
      sendJson(res, 413, { error: "Page too large to mirror" });
      return;
    }

    // Load html-index for link rewriting
    let htmlIdx: Array<{ index: number; url: string; source: string }> = [];
    try {
      const idxRaw = await readFile(
        join(vDir, "raw", "html-index.json"),
        "utf-8",
      );
      htmlIdx = JSON.parse(idxRaw);
    } catch {
      // No index available
    }

    // Find current page URL from index
    const currentEntry = htmlIdx.find((e) => String(e.index) === pageIndex);
    const pageUrl = currentEntry?.url ?? "";

    const rewritten = rewriteHtml(
      rawHtml.toString("utf-8"),
      pageUrl,
      siteId,
      htmlIdx,
    );

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'none'; frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    });
    res.end(rewritten);
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

const VERSION_RE = /^v\d+$/;

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
    if (!VERSION_RE.test(version)) return null;
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
