import {
  h,
  setContent,
  renderSkeletons,
  renderError,
  formatNumber,
  createTabNav,
  capTypeColor,
} from "../utils.js";
import { fetchSite } from "../api.js";
import { setState } from "../state.js";
import { barChart, lineChart, sparkline } from "../components/charts.js";

/**
 * Render analytics — global or per-site.
 * @param {HTMLElement} container
 * @param {string|null} siteId — null for global analytics
 */
export async function renderAnalytics(container, siteId) {
  renderSkeletons(container);

  try {
    if (siteId) {
      await renderSiteAnalytics(container, siteId);
    } else {
      setState("currentSite", null);
      setState("breadcrumbs", [
        { label: "Home", path: "/" },
        { label: "Insights" },
      ]);
      await renderGlobalAnalytics(container);
    }
  } catch (err) {
    renderError(container, `Failed to load analytics: ${err.message}`, () =>
      renderAnalytics(container, siteId),
    );
  }
}

async function renderGlobalAnalytics(container) {
  const data = await fetch("/api/analytics/overview").then((r) => r.json());

  const statCards = h("div", { className: "dashboard-stats" }, [
    statCard(formatNumber(data.totalSites), "Sites Mapped"),
    statCard(formatNumber(data.totalCapabilities), "Capabilities"),
    statCard(formatNumber(data.totalVersions), "Versions"),
    statCard(formatNumber(data.totalPages), "Pages Crawled"),
    statCard(formatNumber(data.totalScreenshots), "Screenshots"),
  ]);

  // Capability type breakdown
  const typeData = Object.entries(data.capsByType ?? {})
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const typeChart = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Capabilities by Type"),
    h("div", { className: "card-body chart-container" }, [
      barChart(typeData, { width: 500, height: 220 }),
    ]),
  ]);

  // Site ranking table
  const siteRanking = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Sites by Capability Count"),
    h("div", { className: "card-body" }, [
      h("table", { className: "data-table" }, [
        h("thead", {}, [
          h("tr", {}, [h("th", {}, "Site"), h("th", {}, "Capabilities")]),
        ]),
        h(
          "tbody",
          {},
          (data.sitesByCapCount ?? []).map((s) =>
            h("tr", {}, [
              h(
                "td",
                {},
                h("a", { href: `#/site/${s.id}/analytics` }, s.title || s.id),
              ),
              h("td", { className: "mono" }, String(s.count)),
            ]),
          ),
        ),
      ]),
    ]),
  ]);

  // Recent crawl activity
  const recentActivity = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Recent Crawl Activity"),
    h("div", { className: "card-body" }, [
      (data.recentCrawls ?? []).length === 0
        ? h("div", { className: "empty-state" }, "No crawls yet")
        : h("table", { className: "data-table" }, [
            h("thead", {}, [
              h("tr", {}, [
                h("th", {}, "Site"),
                h("th", {}, "Version"),
                h("th", {}, "Date"),
              ]),
            ]),
            h(
              "tbody",
              {},
              (data.recentCrawls ?? []).map((c) =>
                h("tr", {}, [
                  h("td", {}, h("a", { href: `#/site/${c.siteId}` }, c.siteId)),
                  h("td", { className: "mono" }, `v${c.version}`),
                  h("td", {}, formatDateShort(c.date)),
                ]),
              ),
            ),
          ]),
    ]),
  ]);

  setContent(
    container,
    h("h2", { style: { marginBottom: "var(--space-4)" } }, "Insights"),
    statCards,
    h("div", { className: "analytics-grid" }, [typeChart, siteRanking]),
    recentActivity,
  );
}

async function renderSiteAnalytics(container, siteId) {
  const [site, data] = await Promise.all([
    fetchSite(siteId),
    fetch(`/api/sites/${encodeURIComponent(siteId)}/analytics`).then((r) =>
      r.json(),
    ),
  ]);

  setState("currentSite", { id: siteId, title: site.title });
  setState("breadcrumbs", [
    { label: "Home", path: "/" },
    { label: "Sites", path: "/sites" },
    { label: site.title || siteId, path: `/site/${siteId}` },
    { label: "Trends" },
  ]);

  const tabNav = createTabNav(siteId, "analytics");

  const capsData = (data.capsOverTime ?? []).map((d) => ({
    label: `v${d.version}`,
    value: d.count,
  }));
  const pagesData = (data.pagesOverTime ?? []).map((d) => ({
    label: `v${d.version}`,
    value: d.count,
  }));

  const capsChart = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Capabilities Over Time"),
    h("div", { className: "card-body chart-container" }, [
      capsData.length >= 2
        ? lineChart(capsData, { width: 500, height: 220, color: "#58a6ff" })
        : h(
            "div",
            { className: "empty-state" },
            "Need 2+ versions for trend data",
          ),
    ]),
  ]);

  const pagesChart = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Pages Over Time"),
    h("div", { className: "card-body chart-container" }, [
      pagesData.length >= 2
        ? lineChart(pagesData, { width: 500, height: 220, color: "#3fb950" })
        : h(
            "div",
            { className: "empty-state" },
            "Need 2+ versions for trend data",
          ),
    ]),
  ]);

  // Type distribution for latest version
  const latestTypes =
    data.capsOverTime?.length > 0
      ? data.capsOverTime[data.capsOverTime.length - 1].types
      : {};
  const typeData = Object.entries(latestTypes)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const typeCard = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Current Type Distribution"),
    h("div", { className: "card-body chart-container" }, [
      barChart(typeData, { width: 400, height: 180 }),
    ]),
  ]);

  // Version comparison table
  const versionTable = h("div", { className: "card" }, [
    h("div", { className: "card-title" }, "Version Comparison"),
    h("div", { className: "card-body" }, [
      h("table", { className: "data-table" }, [
        h("thead", {}, [
          h("tr", {}, [
            h("th", {}, "Version"),
            h("th", {}, "Date"),
            h("th", {}, "Caps"),
            h("th", {}, "Pages"),
            h("th", {}, "Change"),
          ]),
        ]),
        h(
          "tbody",
          {},
          (data.capsOverTime ?? []).map((v, i) => {
            const prev = i > 0 ? data.capsOverTime[i - 1] : null;
            const change = prev ? v.count - prev.count : 0;
            const changeStr =
              change > 0
                ? `+${change}`
                : change === 0
                  ? "\u2014"
                  : String(change);
            const changeColor =
              change > 0
                ? "var(--color-success)"
                : change < 0
                  ? "var(--color-danger)"
                  : "var(--text-muted)";
            return h("tr", {}, [
              h("td", { className: "mono" }, `v${v.version}`),
              h("td", {}, formatDateShort(v.date)),
              h("td", { className: "mono" }, String(v.count)),
              h(
                "td",
                { className: "mono" },
                String(
                  data.pagesOverTime?.find((p) => p.version === v.version)
                    ?.count ?? 0,
                ),
              ),
              h(
                "td",
                { className: "mono", style: { color: changeColor } },
                changeStr,
              ),
            ]);
          }),
        ),
      ]),
    ]),
  ]);

  setContent(
    container,
    tabNav,
    h("div", { className: "analytics-grid" }, [capsChart, pagesChart]),
    h("div", { className: "analytics-grid" }, [typeCard, versionTable]),
  );
}

function statCard(value, label) {
  return h("div", { className: "stat-card" }, [
    h("div", { className: "stat-value" }, value),
    h("div", { className: "stat-label" }, label),
  ]);
}

function formatDateShort(iso) {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "\u2014";
  }
}
