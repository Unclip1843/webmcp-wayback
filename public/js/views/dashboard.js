import { h, setContent, renderSkeletons, renderError, formatNumber, formatDate, capTypeColor } from "../utils.js";
import { fetchSites, fetchStats } from "../api.js";
import { setState } from "../state.js";
import { navigate } from "../router.js";

export async function renderDashboard(container) {
  setState("currentSite", null);
  setState("breadcrumbs", [{ label: "Home" }]);

  setContent(container, h("div", { id: "dashboard" }));
  const root = container.querySelector("#dashboard");

  // Hero section
  root.append(
    h("div", { className: "home-hero" }, [
      h("h1", {}, "WebMCP Wayback"),
      h("p", {}, "Browse, search, and compare website capability maps over time."),
    ])
  );

  // Stats row
  const statsRow = h("div", { className: "dashboard-stats" });
  root.append(statsRow);

  // Quick actions
  root.append(
    h("div", { className: "quick-actions" }, [
      quickAction("Browse Sites", "Explore all mapped sites", "/sites"),
      quickAction("Search", "Find capabilities across sites", null, () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      }),
      quickAction("View Insights", "Global analytics overview", "/analytics"),
    ])
  );

  // Recent sites section
  const recentSection = h("div", { className: "mt-5" }, [
    h("div", { className: "flex items-center justify-between mb-4" }, [
      h("h2", { style: { fontSize: "var(--font-size-lg)", fontWeight: "600" } }, "Recent Sites"),
      h("a", { href: "#/sites", style: { color: "var(--text-link)", fontSize: "var(--font-size-sm)" } }, "View all \u2192"),
    ]),
  ]);
  const recentGrid = h("div", { className: "grid-auto" });
  recentSection.append(recentGrid);
  root.append(recentSection);

  renderSkeletons(recentGrid, 6);

  try {
    const [sites, stats] = await Promise.all([fetchSites(), fetchStats()]);

    setContent(
      statsRow,
      statCard(formatNumber(stats.totalSites), "Sites Mapped"),
      statCard(formatNumber(stats.totalCapabilities), "Capabilities"),
      statCard(formatNumber(stats.totalPages), "Pages Indexed")
    );

    // Show latest 6 sites by crawl date
    const recent = [...sites]
      .sort((a, b) => new Date(b.crawledAt ?? 0) - new Date(a.crawledAt ?? 0))
      .slice(0, 6);

    if (recent.length === 0) {
      setContent(recentGrid, h("div", { className: "empty-state" }, [
        h("div", { className: "empty-state-icon" }, "\u{1F578}\u{FE0F}"),
        h("div", { className: "empty-state-title" }, "No sites yet"),
        h("p", {}, "Use webmcp-mapper to crawl your first site."),
      ]));
    } else {
      setContent(recentGrid, ...recent.map(siteCard));
    }
  } catch (err) {
    renderError(statsRow, `Failed to load: ${err.message}`, () => renderDashboard(container));
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

function quickAction(title, description, path, onClick) {
  const attrs = {
    className: "quick-action-card",
  };

  if (path) {
    attrs.onClick = () => navigate(path);
  } else if (onClick) {
    attrs.onClick = onClick;
  }

  return h("div", attrs, [
    h("div", { className: "quick-action-title" }, title),
    h("div", { className: "quick-action-desc" }, description),
  ]);
}

function statCard(value, label) {
  return h("div", { className: "stat-card" }, [
    h("div", { className: "stat-value" }, value),
    h("div", { className: "stat-label" }, label),
  ]);
}
