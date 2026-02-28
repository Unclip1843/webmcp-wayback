import { h, setContent, renderSkeletons, renderError, renderEmpty } from "../utils.js";
import { fetchSite } from "../api.js";
import { setState } from "../state.js";
import { navigate } from "../router.js";

export async function renderMirror(container, siteId, pageIndex) {
  renderSkeletons(container);

  try {
    const [site, indexRes] = await Promise.all([
      fetchSite(siteId),
      fetch(`/api/sites/${encodeURIComponent(siteId)}/mirror/index`).then((r) =>
        r.json(),
      ),
    ]);

    setState("currentSite", { id: siteId, title: site.title });

    const htmlIndex = Array.isArray(indexRes) ? indexRes : [];

    if (htmlIndex.length === 0) {
      renderEmpty(
        container,
        "\u{1F4F7}",
        "No HTML Captured",
        "Re-crawl this site with the latest mapper to enable mirror view.",
      );
      return;
    }

    // Default to first page if none specified
    const currentIndex =
      pageIndex != null
        ? parseInt(pageIndex, 10)
        : htmlIndex[0]?.index ?? 0;

    const currentEntry = htmlIndex.find((e) => e.index === currentIndex);
    let mode = "full";

    // Tab nav
    const tabNav = h("nav", { className: "tab-nav" }, [
      h("a", { href: `#/site/${siteId}` }, "Overview"),
      h("a", { href: `#/site/${siteId}/capabilities` }, "Capabilities"),
      h("a", { href: `#/site/${siteId}/timeline` }, "Timeline"),
      h("a", { href: `#/site/${siteId}/api` }, "API Explorer"),
      h("a", { href: `#/site/${siteId}/mirror`, className: "active" }, "Mirror"),
    ]);

    // Page selector
    const pageSelect = h("select", {
      className: "mirror-page-select",
      onChange: (e) => {
        navigate(`/site/${siteId}/mirror/${e.target.value}`);
      },
    });

    for (const entry of htmlIndex) {
      const opt = h("option", { value: String(entry.index) }, [
        `${truncateUrl(entry.url)} (${entry.source})`,
      ]);
      if (entry.index === currentIndex) opt.selected = true;
      pageSelect.appendChild(opt);
    }

    // Mode toggle
    const modeToggle = h("div", { className: "mirror-mode-toggle" }, [
      h(
        "button",
        {
          className: "mirror-mode-btn active",
          "data-mode": "full",
          onClick: () => setMode("full"),
        },
        "Full Mirror",
      ),
      h(
        "button",
        {
          className: "mirror-mode-btn",
          "data-mode": "structure",
          onClick: () => setMode("structure"),
        },
        "Structure View",
      ),
    ]);

    // Toolbar
    const toolbar = h("div", { className: "mirror-toolbar" }, [
      pageSelect,
      modeToggle,
      currentEntry
        ? h(
            "a",
            {
              className: "mirror-original-link",
              href: currentEntry.url,
              target: "_blank",
              rel: "noopener",
            },
            "Open original \u2197",
          )
        : null,
    ]);

    // Iframe for rendering
    const iframe = h("iframe", {
      className: "mirror-iframe",
      sandbox: "allow-same-origin",
    });

    // Mirror container
    const mirrorContainer = h("div", { className: "mirror-container" }, [
      iframe,
    ]);

    setContent(container, tabNav, toolbar, mirrorContainer);

    function setMode(newMode) {
      mode = newMode;
      modeToggle.querySelectorAll(".mirror-mode-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
      });
      loadPage();
    }

    function loadPage() {
      const src = `/api/sites/${encodeURIComponent(siteId)}/mirror/${currentIndex}?mode=${mode}`;
      iframe.src = src;
    }

    loadPage();
  } catch (err) {
    renderError(container, `Failed to load mirror: ${err.message}`, () =>
      renderMirror(container, siteId, pageIndex),
    );
  }
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 60 ? path.slice(0, 57) + "..." : path;
  } catch {
    return url.length > 60 ? url.slice(0, 57) + "..." : url;
  }
}
