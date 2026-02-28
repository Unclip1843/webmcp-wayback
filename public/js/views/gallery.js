import {
  h,
  setContent,
  renderSkeletons,
  renderError,
  renderEmpty,
  escapeHtml,
} from "../utils.js";
import { fetchSite, fetchVersions } from "../api.js";
import { setState } from "../state.js";
import { openLightbox } from "../components/lightbox.js";
import { createVersionSelector } from "../components/version-selector.js";
import { createTabNav } from "../utils.js";

export async function renderGallery(container, siteId, versionParam) {
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
      { label: "Gallery" },
    ]);

    if (versions.length === 0) {
      renderEmpty(
        container,
        "\uD83D\uDCF7",
        "No Versions",
        "Crawl this site to create snapshots.",
      );
      return;
    }

    let currentVersion =
      versionParam ?? `v${versions[versions.length - 1].version}`;

    const tabNav = createTabNav(siteId, "gallery");

    const versionSelector = createVersionSelector(
      versions,
      currentVersion,
      (v) => {
        currentVersion = v;
        loadScreenshots();
      },
    );

    const toolbar = h("div", { className: "mirror-toolbar" }, [
      versionSelector,
    ]);
    const grid = h("div", { className: "gallery-grid" });

    setContent(container, tabNav, toolbar, grid);
    loadScreenshots();

    async function loadScreenshots() {
      renderSkeletons(grid, 6);
      try {
        const res = await fetch(
          `/api/sites/${encodeURIComponent(siteId)}/screenshots?version=${encodeURIComponent(currentVersion)}`,
        );
        const data = await res.json();
        const pages = data.pages ?? [];

        if (pages.length === 0) {
          renderEmpty(
            grid,
            "\uD83D\uDCF7",
            "No Screenshots",
            "Re-crawl with the latest mapper to capture screenshots.",
          );
          return;
        }

        const items = pages.map((page) =>
          h(
            "div",
            {
              className: "gallery-item",
              onClick: () => {
                openLightbox(
                  pages.map((p) => ({
                    src: p.screenshotUrl,
                    label: p.url || `Page ${p.index}`,
                  })),
                  pages.indexOf(page),
                );
              },
            },
            [
              h("div", { className: "gallery-thumb-wrap" }, [
                h("img", {
                  src: page.screenshotUrl,
                  className: "gallery-thumb",
                  loading: "lazy",
                  alt: page.url || `Page ${page.index}`,
                }),
              ]),
              h(
                "div",
                { className: "gallery-label mono" },
                page.url ? truncateUrl(page.url) : `Page ${page.index}`,
              ),
            ],
          ),
        );

        setContent(grid, ...items);
      } catch (err) {
        renderError(
          grid,
          `Failed to load screenshots: ${err.message}`,
          loadScreenshots,
        );
      }
    }
  } catch (err) {
    renderError(container, `Failed to load gallery: ${err.message}`, () =>
      renderGallery(container, siteId, versionParam),
    );
  }
}

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 50 ? path.slice(0, 47) + "..." : path;
  } catch {
    return url.length > 50 ? url.slice(0, 47) + "..." : url;
  }
}
