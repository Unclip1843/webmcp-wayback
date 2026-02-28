import { h, setContent, renderSkeletons, renderError, renderEmpty, formatNumber, formatDate, capTypeColor } from "../utils.js";
import { fetchSites } from "../api.js";
import { setState } from "../state.js";
import { navigate } from "../router.js";
import { createSearchInput } from "../components/search.js";

const CAP_TYPES = ["form", "search", "navigation", "api", "action", "download"];

export async function renderSites(container) {
  setState("currentSite", null);
  setState("breadcrumbs", [
    { label: "Home", path: "/" },
    { label: "Sites" },
  ]);

  setContent(container, h("div", { id: "sites-view" }));
  const root = container.querySelector("#sites-view");

  // Header
  root.append(
    h("div", { className: "content-header" }, [
      h("h1", {}, "Site Library"),
      h("p", {}, "Browse, search, and filter all mapped sites."),
    ])
  );

  // Toolbar
  let activeType = null;
  let searchQuery = "";
  let sortBy = "name";

  const toolbar = h("div", { className: "sites-toolbar" });

  const searchInput = createSearchInput("Search sites...", (val) => {
    searchQuery = val;
    renderGrid();
  });

  const pillGroup = h("div", { className: "pill-group" }, [
    createPill("All", null),
    ...CAP_TYPES.map((t) => createPill(t, t)),
  ]);

  const sortSelect = h("select", {
    className: "mirror-page-select",
    onChange: (e) => {
      sortBy = e.target.value;
      renderGrid();
    },
  }, [
    h("option", { value: "name" }, "Sort: Name"),
    h("option", { value: "caps" }, "Sort: Capabilities"),
    h("option", { value: "date" }, "Sort: Last Crawled"),
    h("option", { value: "pages" }, "Sort: Pages"),
  ]);

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

  toolbar.append(searchInput, pillGroup, sortSelect);
  root.append(toolbar);

  // Grid
  const grid = h("div", { className: "grid-auto" });
  root.append(grid);

  renderSkeletons(grid, 6);

  let sites = [];

  try {
    sites = await fetchSites();
    renderGrid();
  } catch (err) {
    renderError(grid, `Failed to load sites: ${err.message}`, () => renderSites(container));
  }

  function renderGrid() {
    let filtered = [...sites];

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

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "caps":
          return (b.capabilityCount ?? 0) - (a.capabilityCount ?? 0);
        case "date":
          return new Date(b.crawledAt ?? 0) - new Date(a.crawledAt ?? 0);
        case "pages":
          return (b.pageCount ?? 0) - (a.pageCount ?? 0);
        default:
          return (a.title ?? a.id).localeCompare(b.title ?? b.id);
      }
    });

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
  for (const type of CAP_TYPES) {
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
