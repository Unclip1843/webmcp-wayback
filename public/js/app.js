import { route, startRouter, navigate } from "./router.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderHeader } from "./components/header.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderSiteDetail } from "./views/site-detail.js";
import { renderCapabilities } from "./views/capabilities.js";
import { renderTimeline } from "./views/timeline.js";
import { renderApiExplorer } from "./views/api-explorer.js";
import { renderMirror } from "./views/mirror.js";
import {
  initSearchPalette,
  toggle as togglePalette,
  isSearchPaletteOpen,
  close as closePalette,
} from "./components/search-palette.js";

// Initialize sidebar and header
renderSidebar(document.getElementById("app-sidebar"));
renderHeader(document.getElementById("app-header"));

// Initialize search palette
initSearchPalette();

// Register routes
const main = document.getElementById("app-main");

route("/", () => renderDashboard(main));
route("/site/:siteId", (p) => renderSiteDetail(main, p.siteId));
route("/site/:siteId/capabilities", (p) => renderCapabilities(main, p.siteId));
route("/site/:siteId/timeline", (p) => renderTimeline(main, p.siteId));
route("/site/:siteId/api", (p) => renderApiExplorer(main, p.siteId));
route("/site/:siteId/mirror", (p) => renderMirror(main, p.siteId));
route("/site/:siteId/mirror/:pageIndex", (p) =>
  renderMirror(main, p.siteId, p.pageIndex),
);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Cmd+K or Ctrl+K opens search palette
  if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    togglePalette();
    return;
  }

  // Close palette on Escape
  if (e.key === "Escape" && isSearchPaletteOpen()) {
    e.preventDefault();
    closePalette();
    return;
  }

  if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
    const active = document.activeElement;
    if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") return;
    e.preventDefault();
    togglePalette();
  }
  if (e.key === "Escape") {
    const searchInput = document.querySelector(".search-wrapper .input");
    if (searchInput && document.activeElement === searchInput) {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.blur();
    }
  }
});

// Start
startRouter();
