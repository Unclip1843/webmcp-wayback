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
import { createCompare } from "../components/image-compare.js";

export async function renderDiff(container, siteId) {
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
      { label: "Visual Diff" },
    ]);

    const tabNav = createTabNav(siteId, "diff");

    if (versions.length < 2) {
      setContent(container, tabNav);
      renderEmpty(
        container,
        "\uD83D\uDD0D",
        "Need 2+ Versions",
        "Crawl the site multiple times to compare visual changes.",
      );
      return;
    }

    let v1 = `v${versions[versions.length - 2].version}`;
    let v2 = `v${versions[versions.length - 1].version}`;
    let mode = "side-by-side";
    let pageIndex = 0;

    // Load screenshots for each version
    const toolbar = h("div", { className: "diff-toolbar" });
    const compareArea = h("div", { className: "diff-compare-area" });

    setContent(container, tabNav, toolbar, compareArea);
    renderToolbar();
    loadComparison();

    function renderToolbar() {
      const v1Select = h("select", {
        className: "mirror-page-select",
        onChange: (e) => {
          v1 = e.target.value;
          loadComparison();
        },
      });
      const v2Select = h("select", {
        className: "mirror-page-select",
        onChange: (e) => {
          v2 = e.target.value;
          loadComparison();
        },
      });

      for (const ver of versions) {
        const vStr = `v${ver.version}`;
        const opt1 = h("option", { value: vStr }, vStr);
        const opt2 = h("option", { value: vStr }, vStr);
        if (vStr === v1) opt1.selected = true;
        if (vStr === v2) opt2.selected = true;
        v1Select.appendChild(opt1);
        v2Select.appendChild(opt2);
      }

      const modeToggle = h("div", { className: "mirror-mode-toggle" }, [
        modeBtn("side-by-side", "Side by Side"),
        modeBtn("slider", "Slider"),
        modeBtn("onion", "Onion Skin"),
      ]);

      setContent(
        toolbar,
        h("div", { className: "diff-toolbar-inner" }, [
          h(
            "label",
            {
              style: {
                color: "var(--text-muted)",
                fontSize: "var(--font-size-sm)",
              },
            },
            "Before:",
          ),
          v1Select,
          h(
            "label",
            {
              style: {
                color: "var(--text-muted)",
                fontSize: "var(--font-size-sm)",
              },
            },
            "After:",
          ),
          v2Select,
          modeToggle,
        ]),
      );
    }

    function modeBtn(m, label) {
      return h(
        "button",
        {
          className: `mirror-mode-btn${m === mode ? " active" : ""}`,
          onClick: () => {
            mode = m;
            renderToolbar();
            loadComparison();
          },
        },
        label,
      );
    }

    async function loadComparison() {
      renderSkeletons(compareArea, 1);
      try {
        const [ss1, ss2] = await Promise.all([
          fetch(
            `/api/sites/${encodeURIComponent(siteId)}/screenshots?version=${encodeURIComponent(v1)}`,
          ).then((r) => r.json()),
          fetch(
            `/api/sites/${encodeURIComponent(siteId)}/screenshots?version=${encodeURIComponent(v2)}`,
          ).then((r) => r.json()),
        ]);

        const pages1 = ss1.pages ?? [];
        const pages2 = ss2.pages ?? [];

        if (pages1.length === 0 && pages2.length === 0) {
          renderEmpty(
            compareArea,
            "\uD83D\uDCF7",
            "No Screenshots",
            "Both versions lack screenshots. Re-crawl to capture them.",
          );
          return;
        }

        // Page selector if multiple pages
        const allIndices = [
          ...new Set([
            ...pages1.map((p) => p.index),
            ...pages2.map((p) => p.index),
          ]),
        ].sort((a, b) => a - b);
        if (!allIndices.includes(pageIndex)) pageIndex = allIndices[0] ?? 0;

        const pageSelector =
          allIndices.length > 1
            ? h(
                "div",
                { className: "diff-page-selector" },
                allIndices.map((idx) =>
                  h(
                    "button",
                    {
                      className: `pill${idx === pageIndex ? " active" : ""}`,
                      onClick: () => {
                        pageIndex = idx;
                        loadComparison();
                      },
                    },
                    `Page ${idx}`,
                  ),
                ),
              )
            : null;

        const img1 = pages1.find((p) => p.index === pageIndex);
        const img2 = pages2.find((p) => p.index === pageIndex);

        if (!img1 && !img2) {
          renderEmpty(
            compareArea,
            "\uD83D\uDCF7",
            "No Screenshot for This Page",
            "Select a different page.",
          );
          return;
        }

        const img1Url = img1?.screenshotUrl ?? "";
        const img2Url = img2?.screenshotUrl ?? "";

        if (!img1Url || !img2Url) {
          setContent(
            compareArea,
            pageSelector,
            h("div", { className: "empty-state" }, [
              h(
                "div",
                { className: "empty-state-title" },
                "Missing screenshot in one version",
              ),
              h(
                "p",
                {},
                `${!img1Url ? v1 : v2} does not have a screenshot for page ${pageIndex}.`,
              ),
            ]),
          );
          return;
        }

        const compareWidget = createCompare(img1Url, img2Url, mode);

        setContent(
          compareArea,
          ...[pageSelector, compareWidget].filter(Boolean),
        );
      } catch (err) {
        renderError(
          compareArea,
          `Failed to load comparison: ${err.message}`,
          loadComparison,
        );
      }
    }

    // Keyboard shortcuts
    const keyHandler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.key === "1") {
        mode = "side-by-side";
        renderToolbar();
        loadComparison();
      }
      if (e.key === "2") {
        mode = "slider";
        renderToolbar();
        loadComparison();
      }
      if (e.key === "3") {
        mode = "onion";
        renderToolbar();
        loadComparison();
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  } catch (err) {
    renderError(container, `Failed to load diff: ${err.message}`, () =>
      renderDiff(container, siteId),
    );
  }
}
