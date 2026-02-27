import { h, setContent, renderSkeletons, renderError, renderEmpty } from "../utils.js";
import { fetchSite } from "../api.js";
import { setState } from "../state.js";
import { methodBadge } from "../components/badge.js";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

export async function renderApiExplorer(container, siteId) {
  setContent(container, h("div", { id: "api-explorer" }));
  const root = container.querySelector("#api-explorer");
  renderSkeletons(root, 3);

  try {
    const site = await fetchSite(siteId);
    setState("currentSite", { ...site, id: siteId });
    renderApiContent(root, site, siteId);
  } catch (err) {
    renderError(root, `Failed to load API endpoints: ${err.message}`, () =>
      renderApiExplorer(container, siteId)
    );
  }
}

function renderApiContent(root, site, siteId) {
  const endpoints = site.apiEndpoints ?? [];

  setContent(root);

  // Tab nav
  root.append(
    h("div", { className: "tab-nav" }, [
      h("a", { href: `#/site/${siteId}` }, "Overview"),
      h("a", { href: `#/site/${siteId}/capabilities` }, "Capabilities"),
      h("a", { href: `#/site/${siteId}/timeline` }, "Timeline"),
      h("a", { href: `#/site/${siteId}/api`, className: "active" }, `API (${endpoints.length})`),
    ])
  );

  if (endpoints.length === 0) {
    renderEmpty(root, "\u{1F517}", "No API endpoints discovered",
      "This site either has no API endpoints or they weren't detected during crawling.");
    return;
  }

  // Filter by method
  let activeMethod = null;

  const filterRow = h("div", { className: "pill-group mb-4" }, [
    createMethodPill("All", null),
    ...METHODS.map((m) => createMethodPill(m, m)),
  ]);

  function createMethodPill(label, method) {
    const count = method
      ? endpoints.filter((e) => (e.method ?? "GET").toUpperCase() === method).length
      : endpoints.length;
    if (method && count === 0) return null;

    const pill = h(
      "button",
      {
        className: `pill${method === activeMethod ? " active" : ""}`,
        onClick: () => {
          activeMethod = method;
          filterRow.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
          renderList();
        },
      },
      `${label} (${count})`
    );
    if (method === null) pill.classList.add("active");
    return pill;
  }

  root.append(filterRow);

  const listContainer = h("div", {});
  root.append(listContainer);

  renderList();

  function renderList() {
    let filtered = endpoints;
    if (activeMethod) {
      filtered = filtered.filter(
        (e) => (e.method ?? "GET").toUpperCase() === activeMethod
      );
    }

    setContent(
      listContainer,
      ...filtered.map((endpoint) => renderEndpoint(endpoint))
    );
  }
}

function renderEndpoint(endpoint) {
  const detail = h("div", { className: "api-endpoint-detail" });

  const header = h(
    "div",
    {
      className: "api-endpoint-header",
      onClick: () => {
        detail.classList.toggle("open");
      },
    },
    [
      h("span", { className: "chevron expandable-header" }, "\u25B6"),
      methodBadge(endpoint.method ?? "GET"),
      h("span", { className: "api-endpoint-url" }, endpoint.url),
      endpoint.contentType
        ? h("span", {
            style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" },
          }, endpoint.contentType)
        : null,
    ]
  );

  // Build detail content
  const detailChildren = [];

  if (endpoint.discoveredFrom) {
    detailChildren.push(
      h("div", { style: { fontSize: "var(--font-size-sm)", color: "var(--text-muted)", marginBottom: "var(--space-3)" } }, [
        h("span", {}, "Discovered from: "),
        h("span", { className: "mono" }, endpoint.discoveredFrom),
      ])
    );
  }

  if (endpoint.requestShape && Object.keys(endpoint.requestShape).length > 0) {
    detailChildren.push(
      h("div", { className: "mb-3" }, [
        h("div", { style: { fontSize: "var(--font-size-xs)", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" } }, "Request Shape"),
        renderShape(endpoint.requestShape),
      ])
    );
  }

  if (endpoint.responseShape && Object.keys(endpoint.responseShape).length > 0) {
    detailChildren.push(
      h("div", {}, [
        h("div", { style: { fontSize: "var(--font-size-xs)", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" } }, "Response Shape"),
        renderShape(endpoint.responseShape),
      ])
    );
  }

  if (detailChildren.length === 0) {
    detailChildren.push(
      h("p", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-sm)" } }, "No additional details available.")
    );
  }

  detail.append(...detailChildren);

  return h("div", { className: "api-endpoint" }, [header, detail]);
}

function renderShape(shape) {
  return h(
    "table",
    { className: "shape-table" },
    h(
      "tbody",
      {},
      Object.entries(shape).map(([key, type]) =>
        h("tr", {}, [
          h("td", { className: "shape-key" }, key),
          h("td", { className: "shape-type" }, String(type)),
        ])
      )
    )
  );
}
