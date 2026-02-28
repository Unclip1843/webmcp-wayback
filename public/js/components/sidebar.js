import { h, setContent } from "../utils.js";
import { subscribe } from "../state.js";
import { navigate, currentPath } from "../router.js";

export function renderSidebar(container) {
  const brand = h("div", { className: "sidebar-brand" }, [
    h("span", { className: "brand-icon" }, "\u{1F578}\u{FE0F}"),
    h("span", {}, "WebMCP Wayback"),
  ]);

  const mainNav = h("nav", { className: "sidebar-nav" });
  const siteNav = h("div", { id: "site-nav" });

  setContent(container, brand, mainNav, siteNav);

  // Main navigation links
  function updateMainNav() {
    setContent(mainNav, navLink("/", "\u{1F3E0}", "Dashboard"));
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
      h("div", { className: "sidebar-section" }, site.title || site.id),
      h("nav", { className: "sidebar-nav" }, [
        navLink(`/site/${id}`, "\u{1F4CB}", "Overview"),
        navLink(`/site/${id}/capabilities`, "\u{26A1}", "Capabilities"),
        navLink(`/site/${id}/timeline`, "\u{1F552}", "Timeline"),
        navLink(`/site/${id}/api`, "\u{1F517}", "API Explorer"),
        navLink(`/site/${id}/mirror`, "\u{1F5BC}\u{FE0F}", "Mirror"),
      ]),
    );
  });

  updateMainNav();

  // Highlight active link on hash change
  window.addEventListener("hashchange", highlightActive);
  highlightActive();
}

function navLink(path, icon, label) {
  const a = h("a", { href: `#${path}` }, [
    h("span", {}, icon),
    h("span", {}, label),
  ]);
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
