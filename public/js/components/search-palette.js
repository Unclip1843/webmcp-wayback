import { h, escapeHtml, debounce, setContent } from "../utils.js";
import { navigate } from "../router.js";

let overlay = null;
let isOpen = false;
let results = [];
let activeIndex = 0;

export function initSearchPalette() {
  overlay = h("div", { className: "search-palette-overlay" }, [
    h("div", { className: "search-palette" }, [
      h("div", { className: "search-palette-input-row" }, [
        h("span", { className: "search-palette-icon" }, "\u{1F50D}"),
        h("input", {
          className: "search-palette-input",
          type: "text",
          placeholder: "Search capabilities across all sites...",
        }),
        h("kbd", { className: "search-palette-kbd" }, "esc"),
      ]),
      h("div", { className: "search-palette-results" }),
      h("div", { className: "search-palette-footer" }, [
        h("span", {}, [
          h("kbd", {}, "\u2191\u2193"),
          " navigate ",
        ]),
        h("span", {}, [
          h("kbd", {}, "\u21B5"),
          " open ",
        ]),
        h("span", {}, [
          h("kbd", {}, "/"),
          " search ",
        ]),
      ]),
    ]),
  ]);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const input = overlay.querySelector(".search-palette-input");
  const resultsContainer = overlay.querySelector(".search-palette-results");

  const doSearch = debounce(async (q) => {
    if (!q.trim()) {
      setContent(resultsContainer);
      results = [];
      activeIndex = 0;
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
      const data = await res.json();
      results = data.results ?? [];
      activeIndex = 0;
      renderResults(resultsContainer, data);
    } catch {
      setContent(
        resultsContainer,
        h("div", { className: "search-palette-empty" }, "Search failed"),
      );
    }
  }, 200);

  input.addEventListener("input", () => doSearch(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      highlightResult(resultsContainer);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightResult(resultsContainer);
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      const r = results[activeIndex];
      close();
      navigate(`/site/${r.siteId}/capabilities`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  document.body.appendChild(overlay);
}

function renderResults(container, data) {
  if (!data.results || data.results.length === 0) {
    setContent(
      container,
      h("div", { className: "search-palette-empty" }, "No results found"),
    );
    return;
  }

  // Group by site
  const grouped = new Map();
  for (const r of data.results) {
    const key = r.siteId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  }

  const children = [];
  for (const [siteId, items] of grouped) {
    const siteTitle = items[0].siteTitle || siteId;
    children.push(
      h("div", { className: "search-palette-group" }, [
        h("div", { className: "search-palette-group-header" }, [
          h("span", {}, siteTitle),
          h("span", { className: "search-palette-group-count" }, `${items.length}`),
        ]),
        ...items.map((item, i) => {
          const globalIndex = data.results.indexOf(item);
          const row = h(
            "div",
            {
              className: `search-palette-item${globalIndex === activeIndex ? " active" : ""}`,
              "data-index": String(globalIndex),
              onClick: () => {
                close();
                navigate(`/site/${item.siteId}/capabilities`);
              },
              onMouseenter: () => {
                activeIndex = globalIndex;
                highlightResult(container);
              },
            },
            [
              h("span", { className: `badge badge-${item.type}` }, item.type),
              h("span", { className: "search-palette-item-name" }, item.name),
              h("span", { className: "search-palette-item-score" }, [
                h("span", {
                  className: "score-bar",
                  style: { width: `${Math.min(item.score * 3, 100)}%` },
                }),
              ]),
            ],
          );
          return row;
        }),
      ]),
    );
  }

  // Facet summary
  if (data.facets) {
    const typeCounts = Object.entries(data.facets.types || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    if (typeCounts.length > 0) {
      children.unshift(
        h("div", { className: "search-palette-facets" },
          typeCounts.map(([type, count]) =>
            h("span", { className: `search-palette-facet badge badge-${type}` }, `${type} (${count})`),
          ),
        ),
      );
    }
  }

  setContent(container, ...children);
}

function highlightResult(container) {
  container.querySelectorAll(".search-palette-item").forEach((el) => {
    const idx = parseInt(el.getAttribute("data-index"), 10);
    el.classList.toggle("active", idx === activeIndex);
    if (idx === activeIndex) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

export function open() {
  if (!overlay) initSearchPalette();
  isOpen = true;
  overlay.classList.add("open");
  const input = overlay.querySelector(".search-palette-input");
  input.value = "";
  input.focus();
  setContent(overlay.querySelector(".search-palette-results"));
  results = [];
  activeIndex = 0;
}

export function close() {
  if (!overlay) return;
  isOpen = false;
  overlay.classList.remove("open");
}

export function toggle() {
  if (isOpen) close();
  else open();
}

export function isSearchPaletteOpen() {
  return isOpen;
}
