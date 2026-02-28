import {
  h,
  setContent,
  renderSkeletons,
  renderError,
  renderEmpty,
  formatDate,
  createTabNav,
} from "../utils.js";
import { fetchSite, fetchVersions } from "../api.js";
import { setState } from "../state.js";
import { createTimelineSlider } from "../components/timeline-slider.js";
import { navigate } from "../router.js";

export async function renderTimelineV2(container, siteId) {
  renderSkeletons(container);

  try {
    const [site, timelineData] = await Promise.all([
      fetchSite(siteId),
      fetch(`/api/sites/${encodeURIComponent(siteId)}/timeline`).then((r) =>
        r.json(),
      ),
    ]);

    setState("currentSite", { id: siteId, title: site.title });
    setState("breadcrumbs", [
      { label: "Home", path: "/" },
      { label: "Sites", path: "/sites" },
      { label: site.title || siteId, path: `/site/${siteId}` },
      { label: "Timeline" },
    ]);

    if (timelineData.length === 0) {
      setContent(container, createTabNav(siteId, "timeline"));
      renderEmpty(
        container,
        "\uD83D\uDD52",
        "No Versions",
        "Crawl this site to create snapshots.",
      );
      return;
    }

    let selectedVersion = timelineData[timelineData.length - 1].version;

    const tabNav = createTabNav(siteId, "timeline");
    const sliderContainer = h("div", { className: "mb-4" });
    const contentArea = h("div", {});

    setContent(container, tabNav, sliderContainer, contentArea);

    function renderSlider() {
      setContent(
        sliderContainer,
        createTimelineSlider(timelineData, selectedVersion, (v) => {
          selectedVersion = v;
          renderSlider();
          renderVersionDetail();
        }),
      );
    }

    async function renderVersionDetail() {
      renderSkeletons(contentArea, 2);
      try {
        const [snap, screenshots] = await Promise.all([
          fetchSite(siteId, `v${selectedVersion}`),
          fetch(
            `/api/sites/${encodeURIComponent(siteId)}/screenshots?version=v${selectedVersion}`,
          ).then((r) => r.json()),
        ]);

        const vData = timelineData.find((v) => v.version === selectedVersion);

        const splitView = h("div", { className: "timeline-split" }, [
          // Screenshot preview
          h("div", { className: "timeline-screenshot-panel" }, [
            screenshots.pages?.length > 0
              ? h("img", {
                  src: screenshots.pages[0].screenshotUrl,
                  className: "timeline-screenshot",
                  onClick: () =>
                    navigate(`/site/${siteId}/gallery/v${selectedVersion}`),
                  style: { cursor: "pointer" },
                })
              : h(
                  "div",
                  {
                    className: "empty-state",
                    style: { padding: "var(--space-5)" },
                  },
                  [
                    h("div", { className: "empty-state-icon" }, "\uD83D\uDCF7"),
                    h("div", {}, "No screenshots"),
                  ],
                ),
          ]),

          // Capability summary
          h("div", { className: "timeline-details-panel" }, [
            h("div", { className: "card" }, [
              h("div", { className: "card-title" }, `v${selectedVersion}`),
              h(
                "div",
                {
                  style: {
                    color: "var(--text-muted)",
                    fontSize: "var(--font-size-sm)",
                  },
                },
                formatDate(vData?.date),
              ),
              h("div", { className: "card-body" }, [
                h("div", { className: "grid-2 mb-4" }, [
                  miniStat(
                    String((snap.capabilities ?? []).length),
                    "Capabilities",
                  ),
                  miniStat(String((snap.pages ?? []).length), "Pages"),
                ]),
                renderTypeSummary(snap.capabilities ?? []),
                h(
                  "div",
                  {
                    className: "mt-4",
                    style: { display: "flex", gap: "var(--space-2)" },
                  },
                  [
                    h(
                      "a",
                      {
                        href: `#/site/${siteId}/capabilities`,
                        className: "pill",
                      },
                      "View Capabilities",
                    ),
                    h(
                      "a",
                      { href: `#/site/${siteId}/mirror`, className: "pill" },
                      "View Mirror",
                    ),
                  ],
                ),
              ]),
            ]),

            // Diff with previous version
            renderAdjacentDiff(timelineData, selectedVersion),
          ]),
        ]);

        setContent(contentArea, splitView);
      } catch (err) {
        renderError(contentArea, `Failed to load version: ${err.message}`);
      }
    }

    renderSlider();
    renderVersionDetail();
  } catch (err) {
    renderError(container, `Failed to load timeline: ${err.message}`, () =>
      renderTimelineV2(container, siteId),
    );
  }
}

function renderTypeSummary(capabilities) {
  const types = {};
  for (const cap of capabilities) {
    types[cap.type] = (types[cap.type] ?? 0) + 1;
  }
  const entries = Object.entries(types).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return h("div");

  return h(
    "div",
    { className: "type-summary" },
    entries.map(([type, count]) =>
      h("div", { className: "type-summary-row" }, [
        h("span", { className: `badge badge-${type}` }, type),
        h(
          "span",
          { className: "mono", style: { color: "var(--text-secondary)" } },
          String(count),
        ),
      ]),
    ),
  );
}

function renderAdjacentDiff(timelineData, selectedVersion) {
  const idx = timelineData.findIndex((v) => v.version === selectedVersion);
  if (idx <= 0) return h("div");

  const prev = timelineData[idx - 1];
  const curr = timelineData[idx];
  const added = curr.capabilityCount - prev.capabilityCount;

  return h("div", { className: "card mt-4" }, [
    h("div", { className: "card-title" }, `Changes from v${prev.version}`),
    h("div", { className: "card-body" }, [
      h("div", { className: "grid-3" }, [
        miniStat(added > 0 ? `+${added}` : String(added), "Cap. Change"),
        miniStat(String(curr.pageCount - prev.pageCount), "Page Change"),
        miniStat(String(curr.screenshotCount), "Screenshots"),
      ]),
    ]),
  ]);
}

function miniStat(value, label) {
  return h("div", { style: { textAlign: "center" } }, [
    h(
      "div",
      {
        className: "mono",
        style: { fontSize: "var(--font-size-lg)", fontWeight: "600" },
      },
      value,
    ),
    h(
      "div",
      {
        style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" },
      },
      label,
    ),
  ]);
}
