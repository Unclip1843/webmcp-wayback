import {
  h,
  setContent,
  renderSkeletons,
  renderError,
  formatNumber,
  formatDate,
  capTypeColor,
  createTabNav,
} from "../utils.js";
import { fetchSite, fetchVersions } from "../api.js";
import { setState } from "../state.js";
import { navigate } from "../router.js";
import { typeBadge, authBadge } from "../components/badge.js";
import { createTreeView } from "../components/tree-view.js";

const CAP_TYPES = ["form", "search", "navigation", "api", "action", "download"];

export async function renderSiteDetail(container, siteId) {
  setContent(container, h("div", { id: "site-detail" }));
  const root = container.querySelector("#site-detail");
  renderSkeletons(root, 4);

  try {
    const [site, versions] = await Promise.all([
      fetchSite(siteId),
      fetchVersions(siteId),
    ]);

    setState("currentSite", { ...site, id: siteId });
    setState("breadcrumbs", [
      { label: "Home", path: "/" },
      { label: "Sites", path: "/sites" },
      { label: site.title || siteId },
    ]);
    renderSiteContent(root, site, siteId, versions);
  } catch (err) {
    renderError(root, `Failed to load site: ${err.message}`, () =>
      renderSiteDetail(container, siteId),
    );
  }
}

function renderSiteContent(root, site, siteId, versions) {
  setContent(root);

  // Tab nav
  root.append(createTabNav(siteId, "overview"));

  // Site header
  root.append(
    h("div", { className: "site-header" }, [
      h("div", {}, [
        h(
          "h1",
          { style: { fontSize: "var(--font-size-xl)", fontWeight: "600" } },
          site.title || siteId,
        ),
        h(
          "p",
          {
            style: {
              color: "var(--text-secondary)",
              marginTop: "var(--space-1)",
            },
          },
          site.description || "",
        ),
        h(
          "div",
          {
            className: "mono mt-2",
            style: {
              color: "var(--text-link)",
              fontSize: "var(--font-size-sm)",
            },
          },
          site.url,
        ),
      ]),
    ]),
  );

  // Stats row
  const caps = site.capabilities ?? [];
  const pages = site.pages ?? [];
  const endpoints = site.apiEndpoints ?? [];
  const authPatterns = site.authPatterns ?? [];

  root.append(
    h("div", { className: "site-stats" }, [
      statCard(formatNumber(pages.length), "Pages"),
      statCard(formatNumber(caps.length), "Capabilities"),
      statCard(formatNumber(endpoints.length), "API Endpoints"),
      statCard(formatNumber(authPatterns.length), "Auth Patterns"),
    ]),
  );

  // Two-column layout
  const sections = h("div", { className: "site-sections" });

  // Left: Donut chart + type breakdown
  const leftCol = h("div", {});
  const typeDistribution = {};
  for (const cap of caps) {
    typeDistribution[cap.type] = (typeDistribution[cap.type] ?? 0) + 1;
  }

  // Build donut chart
  const total = caps.length || 1;
  let cumulativePct = 0;
  const gradientParts = [];

  for (const type of CAP_TYPES) {
    const count = typeDistribution[type] ?? 0;
    if (count === 0) continue;
    const pct = (count / total) * 100;
    gradientParts.push(
      `${capTypeColor(type)} ${cumulativePct}% ${cumulativePct + pct}%`,
    );
    cumulativePct += pct;
  }

  const donut = h("div", {
    className: "donut-chart",
    style: {
      background: gradientParts.length
        ? `conic-gradient(${gradientParts.join(", ")})`
        : "var(--bg-overlay)",
    },
  });

  const legend = h(
    "div",
    { className: "donut-legend" },
    CAP_TYPES.filter((t) => (typeDistribution[t] ?? 0) > 0).map((t) =>
      h("div", { className: "donut-legend-item" }, [
        h("div", {
          className: "donut-legend-color",
          style: { background: capTypeColor(t) },
        }),
        h("span", {}, `${t} (${typeDistribution[t]})`),
      ]),
    ),
  );

  leftCol.append(
    h("div", { className: "card" }, [
      h("div", { className: "card-title" }, "Capability Types"),
      h("div", { className: "card-body flex items-center gap-4" }, [
        donut,
        legend,
      ]),
    ]),
  );

  // Auth patterns
  if (authPatterns.length) {
    leftCol.append(
      h("div", { className: "card mt-4" }, [
        h("div", { className: "card-title" }, "Auth Patterns"),
        h(
          "div",
          { className: "card-body" },
          authPatterns.map((a) =>
            h("div", { className: "flex items-center gap-2 mb-3" }, [
              h("span", { className: "badge badge-auth" }, a.type),
              h(
                "span",
                { style: { fontSize: "var(--font-size-sm)" } },
                a.description,
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  // Right: Page tree
  const rightCol = h("div", {});
  rightCol.append(
    h("div", { className: "card" }, [
      h("div", { className: "card-title" }, `Pages (${pages.length})`),
      h("div", { className: "card-body" }, [createTreeView(pages)]),
    ]),
  );

  // Quick nav buttons
  rightCol.append(
    h("div", { className: "card mt-4" }, [
      h("div", { className: "card-title" }, "Quick Navigation"),
      h("div", { className: "card-body flex flex-col gap-2" }, [
        quickNavBtn(
          `/site/${siteId}/capabilities`,
          "\u26A1",
          "Browse Capabilities",
        ),
        quickNavBtn(
          `/site/${siteId}/gallery`,
          "\uD83D\uDDBC\uFE0F",
          "Screenshot Gallery",
        ),
        quickNavBtn(`/site/${siteId}/mirror`, "\uD83E\uDE9E", "Site Mirror"),
        quickNavBtn(`/site/${siteId}/timeline`, "\u{1F552}", "View Timeline"),
        quickNavBtn(`/site/${siteId}/analytics`, "\uD83D\uDCC8", "View Trends"),
        quickNavBtn(
          `/site/${siteId}/network`,
          "\uD83C\uDF10",
          "Network Requests",
        ),
        quickNavBtn(`/site/${siteId}/diff`, "\uD83D\uDD0D", "Visual Diff"),
        quickNavBtn(`/site/${siteId}/api`, "\u{1F517}", "API Explorer"),
      ]),
    ]),
  );

  sections.append(leftCol, rightCol);
  root.append(sections);
}

function statCard(value, label) {
  return h("div", { className: "stat-card" }, [
    h("div", { className: "stat-value" }, value),
    h("div", { className: "stat-label" }, label),
  ]);
}

function quickNavBtn(path, icon, label) {
  return h(
    "a",
    {
      href: `#${path}`,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-overlay)",
        color: "var(--text-secondary)",
        fontSize: "var(--font-size-sm)",
        transition: "all var(--transition-fast)",
      },
    },
    [h("span", {}, icon), h("span", {}, label)],
  );
}
