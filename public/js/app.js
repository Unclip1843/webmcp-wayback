import { route, startRouter, navigate, currentPath } from "./router.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderHeader } from "./components/header.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderSiteDetail } from "./views/site-detail.js";
import { renderCapabilities } from "./views/capabilities.js";
import { renderTimelineV2 } from "./views/timeline-v2.js";
import { renderApiExplorer } from "./views/api-explorer.js";
import { renderMirror } from "./views/mirror.js";
import { renderGallery } from "./views/gallery.js";
import { renderAnalytics } from "./views/analytics.js";
import { renderNetwork } from "./views/network.js";
import { renderDiff } from "./views/diff.js";
import { renderSites } from "./views/sites.js";
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
route("/sites", () => renderSites(main));
route("/analytics", () => renderAnalytics(main, null));
route("/site/:siteId", (p) => renderSiteDetail(main, p.siteId));
route("/site/:siteId/capabilities", (p) => renderCapabilities(main, p.siteId));
route("/site/:siteId/timeline", (p) => renderTimelineV2(main, p.siteId));
route("/site/:siteId/api", (p) => renderApiExplorer(main, p.siteId));
route("/site/:siteId/mirror", (p) => renderMirror(main, p.siteId));
route("/site/:siteId/mirror/:pageIndex", (p) =>
  renderMirror(main, p.siteId, p.pageIndex),
);
route("/site/:siteId/gallery", (p) => renderGallery(main, p.siteId));
route("/site/:siteId/gallery/:version", (p) =>
  renderGallery(main, p.siteId, p.version),
);
route("/site/:siteId/analytics", (p) => renderAnalytics(main, p.siteId));
route("/site/:siteId/network", (p) => renderNetwork(main, p.siteId));
route("/site/:siteId/network/:version", (p) =>
  renderNetwork(main, p.siteId, p.version),
);
route("/site/:siteId/diff", (p) => renderDiff(main, p.siteId));

// Keyboard shortcuts — "g then X" combos
let gPending = false;
let gTimer = null;

// Help overlay
function showHelpOverlay() {
  let overlay = document.getElementById("shortcut-help");
  if (overlay) {
    overlay.remove();
    return;
  }
  overlay = document.createElement("div");
  overlay.id = "shortcut-help";
  overlay.className = "shortcut-help-overlay";
  overlay.innerHTML = `
    <div class="shortcut-help-panel">
      <h3>Keyboard Shortcuts</h3>
      <div class="shortcut-grid">
        <kbd>Cmd+K</kbd><span>Search palette</span>
        <kbd>/</kbd><span>Search palette</span>
        <kbd>?</kbd><span>This help overlay</span>
        <kbd>g t</kbd><span>Go to timeline</span>
        <kbd>g g</kbd><span>Go to gallery</span>
        <kbd>g s</kbd><span>Go to sites</span>
        <kbd>g a</kbd><span>Go to analytics</span>
        <kbd>g n</kbd><span>Go to network</span>
        <kbd>g d</kbd><span>Go to diff</span>
        <kbd>g m</kbd><span>Go to mirror</span>
        <kbd>1</kbd><span>Side-by-side (diff view)</span>
        <kbd>2</kbd><span>Slider (diff view)</span>
        <kbd>3</kbd><span>Onion skin (diff view)</span>
      </div>
      <p style="color:var(--text-muted);font-size:var(--font-size-xs);margin-top:var(--space-3)">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</p>
    </div>
  `;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  const isInput =
    active?.tagName === "INPUT" ||
    active?.tagName === "TEXTAREA" ||
    active?.tagName === "SELECT";

  // Cmd+K or Ctrl+K opens search palette
  if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    togglePalette();
    return;
  }

  // Close palette on Escape
  if (e.key === "Escape") {
    if (isSearchPaletteOpen()) {
      e.preventDefault();
      closePalette();
      return;
    }
    const help = document.getElementById("shortcut-help");
    if (help) {
      help.remove();
      return;
    }
    const searchInput = document.querySelector(".search-wrapper .input");
    if (searchInput && document.activeElement === searchInput) {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
      searchInput.blur();
    }
    return;
  }

  if (isInput) return;
  if (isSearchPaletteOpen()) return;

  if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    togglePalette();
    return;
  }

  if (e.key === "?") {
    e.preventDefault();
    showHelpOverlay();
    return;
  }

  // "g then X" navigation
  if (gPending) {
    gPending = false;
    clearTimeout(gTimer);
    const siteMatch = currentPath().match(/^\/site\/([^/]+)/);
    if (siteMatch) {
      const sid = siteMatch[1];
      const map = {
        t: "timeline",
        g: "gallery",
        a: "analytics",
        n: "network",
        d: "diff",
        m: "mirror",
      };
      if (map[e.key]) {
        e.preventDefault();
        navigate(`/site/${sid}/${map[e.key]}`);
        return;
      }
    }
    if (e.key === "s") {
      e.preventDefault();
      navigate("/sites");
      return;
    }
    if (e.key === "a") {
      e.preventDefault();
      navigate("/analytics");
      return;
    }
    return;
  }

  if (e.key === "g") {
    gPending = true;
    gTimer = setTimeout(() => {
      gPending = false;
    }, 500);
    return;
  }
});

// Start
startRouter();
