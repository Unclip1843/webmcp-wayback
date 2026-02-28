import { readFile, readdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

interface Capability {
  name: string;
  type: string;
  description: string;
  pageUrl?: string;
  authentication?: string;
  [key: string]: unknown;
}

interface IndexEntry {
  siteId: string;
  siteUrl: string;
  siteTitle: string;
  capIndex: number;
  name: string;
  type: string;
  description: string;
  pageUrl: string;
  authentication: string;
}

interface InvertedIndex {
  /** token → set of entry indices */
  tokens: Map<string, Set<number>>;
  /** site filter: siteId → set of entry indices */
  bySite: Map<string, Set<number>>;
  /** type filter: capType → set of entry indices */
  byType: Map<string, Set<number>>;
  /** auth filter: authType → set of entry indices */
  byAuth: Map<string, Set<number>>;
  /** all entries */
  entries: IndexEntry[];
}

interface SearchResult {
  entry: IndexEntry;
  score: number;
}

interface SearchResponse {
  results: Array<IndexEntry & { score: number }>;
  facets: {
    sites: Record<string, number>;
    types: Record<string, number>;
  };
  total: number;
  query: string;
}

interface SearchParams {
  q: string;
  type?: string;
  site?: string;
  auth?: string;
  urlPattern?: string;
  limit?: number;
  offset?: number;
}

let cachedIndexPromise: Promise<InvertedIndex> | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_./]/g, " ")
    .split(/[\s\-_./]+/)
    .filter((t) => t.length >= 2);
}

function buildIndex(entries: IndexEntry[]): InvertedIndex {
  const tokens = new Map<string, Set<number>>();
  const bySite = new Map<string, Set<number>>();
  const byType = new Map<string, Set<number>>();
  const byAuth = new Map<string, Set<number>>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    // Tokenize name, description, pageUrl
    const nameTokens = tokenize(entry.name);
    const descTokens = tokenize(entry.description);
    const urlTokens = tokenize(entry.pageUrl);

    const allTokens = new Set([...nameTokens, ...descTokens, ...urlTokens]);
    for (const token of allTokens) {
      let set = tokens.get(token);
      if (!set) {
        set = new Set();
        tokens.set(token, set);
      }
      set.add(i);
    }

    // Facets
    let siteSet = bySite.get(entry.siteId);
    if (!siteSet) {
      siteSet = new Set();
      bySite.set(entry.siteId, siteSet);
    }
    siteSet.add(i);

    let typeSet = byType.get(entry.type);
    if (!typeSet) {
      typeSet = new Set();
      byType.set(entry.type, typeSet);
    }
    typeSet.add(i);

    if (entry.authentication) {
      let authSet = byAuth.get(entry.authentication);
      if (!authSet) {
        authSet = new Set();
        byAuth.set(entry.authentication, authSet);
      }
      authSet.add(i);
    }
  }

  return { tokens, bySite, byType, byAuth, entries };
}

function scoreEntry(
  entry: IndexEntry,
  queryTokens: string[],
  rawQuery: string,
): number {
  let score = 0;
  const nameLower = entry.name.toLowerCase();
  const descLower = entry.description.toLowerCase();
  const urlLower = entry.pageUrl.toLowerCase();

  for (const token of queryTokens) {
    if (nameLower.includes(token)) score += 3;
    if (descLower.includes(token)) score += 1;
    if (urlLower.includes(token)) score += 0.5;
  }

  // Exact substring bonus in name
  if (nameLower.includes(rawQuery.toLowerCase())) {
    score += 10;
  }

  return score;
}

async function loadEntries(sitesDir: string): Promise<IndexEntry[]> {
  const entries: IndexEntry[] = [];

  let siteIds: string[];
  try {
    siteIds = await readdir(sitesDir);
  } catch {
    return entries;
  }

  for (const siteId of siteIds) {
    const siteMap = await loadLatestSiteMap(sitesDir, siteId);
    if (!siteMap) continue;

    const caps: Capability[] = siteMap.capabilities ?? [];
    for (let i = 0; i < caps.length; i++) {
      const cap = caps[i]!;
      entries.push({
        siteId,
        siteUrl: siteMap.url ?? "",
        siteTitle: siteMap.title ?? siteId,
        capIndex: i,
        name: cap.name ?? "",
        type: cap.type ?? "",
        description: cap.description ?? "",
        pageUrl: cap.pageUrl ?? "",
        authentication: cap.authentication ?? "",
      });
    }
  }

  return entries;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadLatestSiteMap(
  sitesDir: string,
  siteId: string,
): Promise<any> {
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

async function buildIndexFromDisk(dataDir: string): Promise<InvertedIndex> {
  const sitesDir = join(dataDir, "sites");
  const indexPath = join(dataDir, "search-index.json");

  // Try loading persisted index
  try {
    const raw = await readFile(indexPath, "utf-8");
    const data = JSON.parse(raw) as { entries: IndexEntry[] };
    return buildIndex(data.entries);
  } catch {
    // No persisted index, build from scratch
  }

  const entries = await loadEntries(sitesDir);
  const index = buildIndex(entries);

  // Persist for next startup
  try {
    const tmpPath = `${indexPath}.tmp.${process.pid}`;
    await writeFile(tmpPath, JSON.stringify({ entries }, null, 0));
    await rename(tmpPath, indexPath);
  } catch {
    // Non-fatal: index works in memory
  }

  return index;
}

export function getOrBuildIndex(dataDir: string): Promise<InvertedIndex> {
  if (!cachedIndexPromise) {
    cachedIndexPromise = buildIndexFromDisk(dataDir).catch((err) => {
      cachedIndexPromise = null;
      throw err;
    });
  }
  return cachedIndexPromise;
}

export async function rebuildIndex(
  dataDir: string,
): Promise<{ entryCount: number }> {
  const sitesDir = join(dataDir, "sites");
  const entries = await loadEntries(sitesDir);
  const index = buildIndex(entries);

  const indexPath = join(dataDir, "search-index.json");
  const tmpPath = `${indexPath}.tmp.${process.pid}`;
  await writeFile(tmpPath, JSON.stringify({ entries }, null, 0));
  await rename(tmpPath, indexPath);

  cachedIndexPromise = Promise.resolve(index);

  return { entryCount: entries.length };
}

export async function search(
  dataDir: string,
  params: SearchParams,
): Promise<SearchResponse> {
  const index = await getOrBuildIndex(dataDir);
  const queryTokens = tokenize(params.q);
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  if (queryTokens.length === 0) {
    return {
      results: [],
      facets: { sites: {}, types: {} },
      total: 0,
      query: params.q,
    };
  }

  // Gather candidate indices from token matches
  const candidateScores = new Map<number, number>();
  for (const token of queryTokens) {
    const matches = index.tokens.get(token);
    if (matches) {
      for (const idx of matches) {
        candidateScores.set(idx, (candidateScores.get(idx) ?? 0) + 1);
      }
    }
  }

  // Apply filters
  let candidates = [...candidateScores.keys()];

  if (params.type) {
    const typeSet = index.byType.get(params.type);
    if (typeSet) {
      candidates = candidates.filter((i) => typeSet.has(i));
    } else {
      candidates = [];
    }
  }

  if (params.site) {
    const siteSet = index.bySite.get(params.site);
    if (siteSet) {
      candidates = candidates.filter((i) => siteSet.has(i));
    } else {
      candidates = [];
    }
  }

  if (params.auth) {
    const authSet = index.byAuth.get(params.auth);
    if (authSet) {
      candidates = candidates.filter((i) => authSet.has(i));
    } else {
      candidates = [];
    }
  }

  if (params.urlPattern) {
    const pattern = params.urlPattern.toLowerCase();
    candidates = candidates.filter((i) =>
      index.entries[i]!.pageUrl.toLowerCase().includes(pattern),
    );
  }

  // Score and sort
  const scored: SearchResult[] = candidates.map((i) => ({
    entry: index.entries[i]!,
    score: scoreEntry(index.entries[i]!, queryTokens, params.q),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Build facets from all matches (before pagination)
  const facets: SearchResponse["facets"] = { sites: {}, types: {} };
  for (const { entry } of scored) {
    facets.sites[entry.siteId] = (facets.sites[entry.siteId] ?? 0) + 1;
    facets.types[entry.type] = (facets.types[entry.type] ?? 0) + 1;
  }

  const total = scored.length;
  const page = scored.slice(offset, offset + limit);

  return {
    results: page.map(({ entry, score }) => ({ ...entry, score })),
    facets,
    total,
    query: params.q,
  };
}
