import {
  h,
  setContent,
  renderSkeletons,
  renderError,
  renderEmpty,
  createTabNav,
} from "../utils.js";
import { fetchSite } from "../api.js";
import { setState } from "../state.js";
import { capabilityCard } from "../components/capability-card.js";
import { createSearchInput } from "../components/search.js";

const CAP_TYPES = ["form", "search", "navigation", "api", "action", "download"];

export async function renderCapabilities(container, siteId) {
  setContent(container, h("div", { id: "capabilities-view" }));
  const root = container.querySelector("#capabilities-view");
  renderSkeletons(root, 4);

  try {
    const site = await fetchSite(siteId);
    setState("currentSite", { ...site, id: siteId });
    setState("breadcrumbs", [
      { label: "Home", path: "/" },
      { label: "Sites", path: "/sites" },
      { label: site.title || siteId, path: `/site/${siteId}` },
      { label: "Capabilities" },
    ]);
    renderCapabilitiesContent(root, site, siteId);
  } catch (err) {
    renderError(root, `Failed to load capabilities: ${err.message}`, () =>
      renderCapabilities(container, siteId),
    );
  }
}

function renderCapabilitiesContent(root, site, siteId) {
  const allCaps = site.capabilities ?? [];
  let activeType = null;
  let searchQuery = "";
  let sortBy = "name";
  let groupBy = null;

  setContent(root);

  // Tab nav
  root.append(createTabNav(siteId, "capabilities"));

  // Toolbar
  const toolbar = h("div", { className: "capabilities-toolbar" });

  const searchInput = createSearchInput("Search capabilities...", (val) => {
    searchQuery = val;
    renderList();
  });

  const pillGroup = h("div", { className: "pill-group" }, [
    createPill("All", null),
    ...CAP_TYPES.map((t) => createPill(t, t)),
  ]);

  function createPill(label, type) {
    const pill = h(
      "button",
      {
        className: `pill${type === activeType ? " active" : ""}`,
        onClick: () => {
          activeType = type;
          pillGroup
            .querySelectorAll(".pill")
            .forEach((p) => p.classList.remove("active"));
          pill.classList.add("active");
          renderList();
        },
      },
      label,
    );
    if (type === null) pill.classList.add("active");
    return pill;
  }

  // Group by toggle
  const groupToggle = h("div", { className: "pill-group" }, [
    h(
      "button",
      {
        className: "pill active",
        onClick: (e) => {
          groupBy = null;
          groupToggle
            .querySelectorAll(".pill")
            .forEach((p) => p.classList.remove("active"));
          e.target.classList.add("active");
          renderList();
        },
      },
      "No grouping",
    ),
    h(
      "button",
      {
        className: "pill",
        onClick: (e) => {
          groupBy = "type";
          groupToggle
            .querySelectorAll(".pill")
            .forEach((p) => p.classList.remove("active"));
          e.target.classList.add("active");
          renderList();
        },
      },
      "By type",
    ),
    h(
      "button",
      {
        className: "pill",
        onClick: (e) => {
          groupBy = "page";
          groupToggle
            .querySelectorAll(".pill")
            .forEach((p) => p.classList.remove("active"));
          e.target.classList.add("active");
          renderList();
        },
      },
      "By page",
    ),
  ]);

  toolbar.append(searchInput, pillGroup, groupToggle);
  root.append(toolbar);

  // List container
  const list = h("div", { className: "capability-list" });
  root.append(list);

  renderList();

  function renderList() {
    let filtered = allCaps;

    if (activeType) {
      filtered = filtered.filter((c) => c.type === activeType);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.page ?? "").toLowerCase().includes(q),
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "confidence")
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    if (filtered.length === 0) {
      renderEmpty(
        list,
        "\u26A1",
        "No capabilities found",
        "Try adjusting your filters.",
      );
      return;
    }

    if (groupBy) {
      const groups = new Map();
      for (const cap of filtered) {
        const key = groupBy === "type" ? cap.type : (cap.page ?? "unknown");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(cap);
      }

      const elements = [];
      for (const [key, caps] of groups) {
        elements.push(
          h(
            "div",
            { className: "sidebar-section mt-4" },
            `${key} (${caps.length})`,
          ),
        );
        for (const cap of caps) {
          elements.push(capabilityCard(cap));
        }
      }
      setContent(list, ...elements);
    } else {
      setContent(list, ...filtered.map(capabilityCard));
    }
  }
}
