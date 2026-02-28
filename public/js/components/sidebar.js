import { h, setContent } from "../utils.js";
import { subscribe } from "../state.js";
import { currentPath } from "../router.js";

export function renderSidebar(container) {
  const brand = h("div", { className: "sidebar-brand" }, [
    h("span", { className: "brand-icon" }, "\uD83D\uDD78\uFE0F"),
    h("span", {}, "WebMCP Wayback"),
  ]);

  const mainNav = h("nav", { className: "sidebar-nav" });
  const siteNav = h("div", { id: "site-nav" });

  setContent(container, brand, mainNav, siteNav);

  function updateMainNav() {
    setContent(mainNav,
      navLink("/", "Home"),
      navLink("/sites", "Sites"),
      navLink("/analytics", "Insights"),
    );
  }

  // Site-specific nav (shown when viewing a site)
  subscribe("currentSite", (site) => {
    if (!site) {
      setContent(siteNav);
      return;
    }
    const id = site.id;
    setContent(
      siteNav,
      // Back link
      h("a", { href: "#/sites", className: "sidebar-back" }, "\u2190 Back to Sites"),
      // Site title
      h("div", { className: "sidebar-section" }, site.title || site.id),
      // Explore group
      h("div", { className: "sidebar-group-label" }, "Explore"),
      h("nav", { className: "sidebar-nav sidebar-nav-grouped" }, [
        navLink(`/site/${id}`, "Overview"),
        navLink(`/site/${id}/capabilities`, "Capabilities"),
        navLink(`/site/${id}/gallery`, "Gallery"),
        navLink(`/site/${id}/mirror`, "Mirror"),
      ]),
      // Analyze group
      h("div", { className: "sidebar-group-label" }, "Analyze"),
      h("nav", { className: "sidebar-nav sidebar-nav-grouped" }, [
        navLink(`/site/${id}/timeline`, "Timeline"),
        navLink(`/site/${id}/analytics`, "Trends"),
        navLink(`/site/${id}/network`, "Network"),
        navLink(`/site/${id}/diff`, "Visual Diff"),
      ]),
      // Develop group
      h("div", { className: "sidebar-group-label" }, "Develop"),
      h("nav", { className: "sidebar-nav sidebar-nav-grouped" }, [
        navLink(`/site/${id}/api`, "API Explorer"),
      ]),
    );
    highlightActive();
  });

  updateMainNav();

  // Highlight active link on hash change
  window.addEventListener("hashchange", highlightActive);
  highlightActive();
}

function navLink(path, label) {
  const a = h("a", { href: `#${path}` }, label);
  if (currentPath() === path) a.classList.add("active");
  return a;
}

function highlightActive() {
  const path = currentPath();
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    const href = a.getAttribute("href")?.slice(1);
    a.classList.toggle("active", href === path);
  });
}
