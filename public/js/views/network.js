import {
  h,
  setContent,
  renderSkeletons,
  renderError,
  renderEmpty,
  createTabNav,
} from "../utils.js";
import { fetchSite, fetchVersions } from "../api.js";
import { setState } from "../state.js";
import { createVersionSelector } from "../components/version-selector.js";

export async function renderNetwork(container, siteId, versionParam) {
  renderSkeletons(container);

  try {
    const [site, versions] = await Promise.all([
      fetchSite(siteId),
      fetchVersions(siteId),
    ]);

    setState("currentSite", { id: siteId, title: site.title });
    setState("breadcrumbs", [
      { label: "Home", path: "/" },
      { label: "Sites", path: "/sites" },
      { label: site.title || siteId, path: `/site/${siteId}` },
      { label: "Network" },
    ]);

    if (versions.length === 0) {
      setContent(container, createTabNav(siteId, "network"));
      renderEmpty(
        container,
        "\uD83C\uDF10",
        "No Versions",
        "Crawl this site to capture network data.",
      );
      return;
    }

    let currentVersion =
      versionParam ?? `v${versions[versions.length - 1].version}`;
    let sortKey = "url";
    let sortDir = 1;

    const tabNav = createTabNav(siteId, "network");
    const versionSelector = createVersionSelector(
      versions,
      currentVersion,
      (v) => {
        currentVersion = v;
        loadNetwork();
      },
    );

    const toolbar = h("div", { className: "mirror-toolbar" }, [
      versionSelector,
    ]);
    const content = h("div", {});

    setContent(container, tabNav, toolbar, content);
    loadNetwork();

    async function loadNetwork() {
      renderSkeletons(content, 3);
      try {
        const data = await fetch(
          `/api/sites/${encodeURIComponent(siteId)}/network?version=${encodeURIComponent(currentVersion)}`,
        ).then((r) => r.json());

        const sections = [
          {
            key: "apis",
            label: "API Calls",
            icon: "\uD83D\uDD17",
            items: data.apis ?? [],
          },
          {
            key: "resources",
            label: "Resources",
            icon: "\uD83D\uDCC4",
            items: data.resources ?? [],
          },
          {
            key: "thirdParty",
            label: "Third-Party",
            icon: "\uD83C\uDF10",
            items: data.thirdParty ?? [],
          },
        ];

        const totalRequests = sections.reduce(
          (s, sec) => s + sec.items.length,
          0,
        );

        if (totalRequests === 0) {
          renderEmpty(
            content,
            "\uD83C\uDF10",
            "No Network Data",
            "Re-crawl with the latest mapper to capture network requests.",
          );
          return;
        }

        const statBar = h("div", { className: "network-stats" }, [
          h(
            "span",
            { className: "badge badge-api" },
            `${data.apis?.length ?? 0} APIs`,
          ),
          h(
            "span",
            { className: "badge badge-navigation" },
            `${data.resources?.length ?? 0} Resources`,
          ),
          h(
            "span",
            { className: "badge badge-action" },
            `${data.thirdParty?.length ?? 0} Third-Party`,
          ),
          h(
            "span",
            {
              style: {
                color: "var(--text-muted)",
                fontSize: "var(--font-size-sm)",
              },
            },
            `${totalRequests} total`,
          ),
        ]);

        const sectionEls = sections
          .filter((sec) => sec.items.length > 0)
          .map((sec) =>
            renderNetworkSection(sec, sortKey, sortDir, (key) => {
              if (sortKey === key) {
                sortDir *= -1;
              } else {
                sortKey = key;
                sortDir = 1;
              }
              loadNetwork();
            }),
          );

        setContent(content, statBar, ...sectionEls);
      } catch (err) {
        renderError(
          content,
          `Failed to load network data: ${err.message}`,
          loadNetwork,
        );
      }
    }
  } catch (err) {
    renderError(container, `Failed to load network: ${err.message}`, () =>
      renderNetwork(container, siteId, versionParam),
    );
  }
}

function renderNetworkSection(section, sortKey, sortDir, onSort) {
  const sorted = [...section.items].sort((a, b) => {
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";
    if (typeof aVal === "number") return (aVal - bVal) * sortDir;
    return String(aVal).localeCompare(String(bVal)) * sortDir;
  });

  return h("div", { className: "card mb-4" }, [
    h("div", { className: "card-title" }, [
      h("span", {}, section.icon + " "),
      `${section.label} (${section.items.length})`,
    ]),
    h("div", { className: "card-body" }, [
      h("table", { className: "data-table" }, [
        h("thead", {}, [
          h("tr", {}, [
            sortTh("URL", "url", sortKey, sortDir, onSort),
            sortTh("Method", "method", sortKey, sortDir, onSort),
            sortTh("Status", "status", sortKey, sortDir, onSort),
            sortTh("Type", "contentType", sortKey, sortDir, onSort),
          ]),
        ]),
        h(
          "tbody",
          {},
          sorted
            .slice(0, 100)
            .map((req) =>
              h("tr", {}, [
                h(
                  "td",
                  { className: "mono network-url-cell", title: req.url },
                  truncateUrl(req.url),
                ),
                h(
                  "td",
                  {},
                  h(
                    "span",
                    {
                      className: `badge badge-${(req.method ?? "GET").toLowerCase()}`,
                    },
                    req.method ?? "GET",
                  ),
                ),
                h(
                  "td",
                  {},
                  h(
                    "span",
                    {
                      className: "mono",
                      style: { color: statusColor(req.status) },
                    },
                    String(req.status || "\u2014"),
                  ),
                ),
                h(
                  "td",
                  {
                    className: "mono",
                    style: {
                      color: "var(--text-muted)",
                      fontSize: "var(--font-size-xs)",
                    },
                  },
                  shortContentType(req.contentType),
                ),
              ]),
            ),
        ),
      ]),
      sorted.length > 100
        ? h(
            "div",
            {
              style: {
                color: "var(--text-muted)",
                fontSize: "var(--font-size-xs)",
                padding: "var(--space-2)",
              },
            },
            `Showing 100 of ${sorted.length}`,
          )
        : null,
    ]),
  ]);
}

function sortTh(label, key, activeKey, dir, onSort) {
  const arrow = activeKey === key ? (dir > 0 ? " \u2191" : " \u2193") : "";
  return h("th", { onClick: () => onSort(key) }, label + arrow);
}

function statusColor(status) {
  if (!status) return "var(--text-muted)";
  if (status >= 200 && status < 300) return "var(--color-success)";
  if (status >= 300 && status < 400) return "var(--color-info)";
  if (status >= 400 && status < 500) return "var(--color-warning)";
  if (status >= 500) return "var(--color-danger)";
  return "var(--text-muted)";
}

function truncateUrl(url) {
  if (!url) return "\u2014";
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 70 ? path.slice(0, 67) + "..." : path;
  } catch {
    return url.length > 70 ? url.slice(0, 67) + "..." : url;
  }
}

function shortContentType(ct) {
  if (!ct) return "\u2014";
  const short = ct.split(";")[0].trim();
  return short.replace("application/", "").replace("text/", "");
}
