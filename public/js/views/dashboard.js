import { h, setContent, renderSkeletons, renderError, renderEmpty, formatNumber, formatDate, capTypeColor } from "../utils.js";
import { fetchSites, fetchStats } from "../api.js";
import { setState } from "../state.js";
import { navigate } from "../router.js";
import { createSearchInput } from "../components/search.js";
import { typeBadge } from "../components/badge.js";

const CAP_TYPES = ["form", "search", "navigation", "api", "action", "download"];

export async function renderDashboard(container) {
  setState("currentSite", null);

  setContent(container, h("div", { id: "dashboard" }));
  const root = container.querySelector("#dashboard");

  // Header
  root.append(
    h("div", { className: "content-header" }, [
      h("h1", {}, "Site Capability Maps"),
      h("p", {}, "Browse, search, and compare website capabilities over time."),
    ])
  );

  // Stats
  const statsRow = h("div", { className: "dashboard-stats" });
  root.append(statsRow);

  // Filters
  let activeType = null;
  let searchQuery = "";

  const filtersRow = h("div", { className: "dashboard-filters" });
  const searchInput = createSearchInput("Filter sites...", (val) => {
    searchQuery = val;
    renderGrid();
  });

  const pillGroup = h("div", { className: "pill-group" }, [
    createPill("All", null),
    ...CAP_TYPES.map((t) => createPill(t, t)),
  ]);

  filtersRow.append(searchInput, pillGroup);
  root.append(filtersRow);

  function createPill(label, type) {
    const pill = h(
      "button",
      {
        className: `pill${type === activeType ? " active" : ""}`,
        onClick: () => {
          activeType = type;
          pillGroup.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
          renderGrid();
        },
      },
      label
    );
    if (type === null) pill.classList.add("active");
    return pill;
  }

  // Grid
  const grid = h("div", { className: "grid-auto" });
  root.append(grid);

  renderSkeletons(grid, 6);

  let sites = [];

  try {
    const [sitesData, statsData] = await Promise.all([fetchSites(), fetchStats()]);
    sites = sitesData;

    setContent(
      statsRow,
      statCard(formatNumber(statsData.totalSites), "Sites Mapped"),
      statCard(formatNumber(statsData.totalCapabilities), "Capabilities"),
      statCard(formatNumber(statsData.totalPages), "Pages Indexed")
    );

    renderGrid();
  } catch (err) {
    renderError(grid, `Failed to load sites: ${err.message}`, () => renderDashboard(container));
  }

  function renderGrid() {
    let filtered = sites;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.url.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }

    if (activeType) {
      filtered = filtered.filter((s) => (s.typeDistribution[activeType] ?? 0) > 0);
    }

    if (filtered.length === 0) {
      renderEmpty(grid, "\u{1F50D}", "No sites found", searchQuery ? "Try a different search." : "No site data available.");
      return;
    }

    setContent(grid, ...filtered.map(siteCard));
  }
}

function siteCard(site) {
  const typeBar = h("div", { className: "type-bar mt-2" });
  const total = site.capabilityCount || 1;
  for (const type of ["form", "search", "navigation", "api", "action", "download"]) {
    const count = site.typeDistribution[type] ?? 0;
    if (count > 0) {
      typeBar.append(
        h("div", {
          className: "type-bar-segment",
          style: { flex: count / total, background: capTypeColor(type) },
          title: `${type}: ${count}`,
        })
      );
    }
  }

  return h(
    "div",
    {
      className: "card card-clickable",
      onClick: () => navigate(`/site/${site.id}`),
    },
    [
      h("div", { className: "card-title" }, site.title || site.id),
      h("div", { className: "card-subtitle" }, site.url),
      h("div", { className: "card-body" }, [
        h("div", { className: "flex justify-between" }, [
          h("span", { className: "mono" }, `${site.capabilityCount} capabilities`),
          h("span", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" } }, `${site.pageCount} pages`),
        ]),
        typeBar,
      ]),
      h("div", { className: "card-footer" }, [
        h("span", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" } }, formatDate(site.crawledAt)),
        h("span", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" } }, `${site.versions} version${site.versions !== 1 ? "s" : ""}`),
      ]),
    ]
  );
}

function statCard(value, label) {
  return h("div", { className: "stat-card" }, [
    h("div", { className: "stat-value" }, value),
    h("div", { className: "stat-label" }, label),
  ]);
}
