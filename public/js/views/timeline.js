import { h, setContent, renderSkeletons, renderError, renderEmpty, formatDate } from "../utils.js";
import { fetchSite, fetchVersions } from "../api.js";
import { setState } from "../state.js";
import { createTimeline } from "../components/timeline.js";
import { computeDiff, renderDiff } from "../components/diff-view.js";

export async function renderTimeline(container, siteId) {
  setContent(container, h("div", { id: "timeline-view" }));
  const root = container.querySelector("#timeline-view");
  renderSkeletons(root, 3);

  try {
    const [site, versions] = await Promise.all([
      fetchSite(siteId),
      fetchVersions(siteId),
    ]);

    setState("currentSite", { ...site, id: siteId });
    renderTimelineContent(root, site, siteId, versions);
  } catch (err) {
    renderError(root, `Failed to load timeline: ${err.message}`, () =>
      renderTimeline(container, siteId)
    );
  }
}

function renderTimelineContent(root, site, siteId, versions) {
  setContent(root);

  // Tab nav
  root.append(
    h("div", { className: "tab-nav" }, [
      h("a", { href: `#/site/${siteId}` }, "Overview"),
      h("a", { href: `#/site/${siteId}/capabilities` }, "Capabilities"),
      h("a", { href: `#/site/${siteId}/timeline`, className: "active" }, `Timeline (${versions.length})`),
      h("a", { href: `#/site/${siteId}/api` }, "API"),
    ])
  );

  if (versions.length === 0) {
    renderEmpty(root, "\u{1F552}", "No snapshots available", "Crawl the site to create a snapshot.");
    return;
  }

  let mode = "view"; // "view" or "compare"
  let selectedVersion = versions[versions.length - 1].version;
  let compareVersion = versions.length > 1 ? versions[0].version : null;

  // Mode toggle
  const modeToggle = h("div", { className: "pill-group mb-4" }, [
    h("button", {
      className: "pill active",
      onClick: (e) => {
        mode = "view";
        modeToggle.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
        e.target.classList.add("active");
        renderContent();
      },
    }, "View Snapshot"),
    h("button", {
      className: `pill${versions.length < 2 ? "" : ""}`,
      onClick: (e) => {
        if (versions.length < 2) return;
        mode = "compare";
        modeToggle.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
        e.target.classList.add("active");
        renderContent();
      },
      title: versions.length < 2 ? "Need at least 2 snapshots to compare" : "",
      style: versions.length < 2 ? { opacity: "0.5", cursor: "not-allowed" } : {},
    }, "Compare Snapshots"),
  ]);

  root.append(modeToggle);

  const timelineContainer = h("div", {});
  const contentArea = h("div", {});
  root.append(timelineContainer, contentArea);

  renderContent();

  async function renderContent() {
    if (mode === "view") {
      // Timeline with single selection
      setContent(
        timelineContainer,
        createTimeline(versions, selectedVersion, async (v) => {
          selectedVersion = v;
          await renderContent();
        })
      );

      setContent(contentArea, h("div", { className: "mt-4" }));
      const inner = contentArea.firstChild;
      renderSkeletons(inner, 2);

      try {
        const snap = await fetchSite(siteId, `v${selectedVersion}`);
        const ver = versions.find((v) => v.version === selectedVersion);

        setContent(inner,
          h("div", { className: "card" }, [
            h("div", { className: "card-title" }, [
              `Snapshot v${selectedVersion}`,
              h("span", {
                style: { fontWeight: "normal", color: "var(--text-muted)", marginLeft: "var(--space-2)", fontSize: "var(--font-size-sm)" },
              }, formatDate(ver?.crawledAt)),
            ]),
            h("div", { className: "card-body" }, [
              h("div", { className: "grid-3 mb-4" }, [
                miniStat((snap.pages ?? []).length, "Pages"),
                miniStat((snap.capabilities ?? []).length, "Capabilities"),
                miniStat((snap.apiEndpoints ?? []).length, "API Endpoints"),
              ]),
              h("p", { style: { color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" } },
                snap.description || "No description available."
              ),
            ]),
          ])
        );
      } catch (err) {
        renderError(inner, `Failed to load snapshot: ${err.message}`);
      }
    } else {
      // Compare mode: two timelines
      setContent(
        timelineContainer,
        h("div", { className: "flex flex-col gap-3" }, [
          h("div", { className: "flex items-center gap-3" }, [
            h("span", { style: { color: "var(--color-danger)", fontSize: "var(--font-size-sm)", width: "60px" } }, "Before:"),
            createTimeline(versions, compareVersion, (v) => {
              compareVersion = v;
              renderCompare();
            }),
          ]),
          h("div", { className: "flex items-center gap-3" }, [
            h("span", { style: { color: "var(--color-success)", fontSize: "var(--font-size-sm)", width: "60px" } }, "After:"),
            createTimeline(versions, selectedVersion, (v) => {
              selectedVersion = v;
              renderCompare();
            }),
          ]),
        ])
      );

      await renderCompare();
    }
  }

  async function renderCompare() {
    setContent(contentArea, h("div", { className: "mt-4" }));
    const inner = contentArea.firstChild;
    renderSkeletons(inner, 2);

    if (compareVersion === null || compareVersion === selectedVersion) {
      setContent(inner,
        h("div", { className: "empty-state" }, [
          h("div", { className: "empty-state-title" }, "Select two different snapshots to compare"),
        ])
      );
      return;
    }

    try {
      const [oldSnap, newSnap] = await Promise.all([
        fetchSite(siteId, `v${compareVersion}`),
        fetchSite(siteId, `v${selectedVersion}`),
      ]);

      const diff = computeDiff(oldSnap, newSnap);

      setContent(inner,
        h("div", {}, [
          h("div", { className: "site-url-bar mb-4", style: { display: "inline-flex" } }, [
            h("span", {}, "\u{1F310}"),
            h("span", { className: "url-text" }, site.url),
            h("span", { className: "url-date" }, `v${compareVersion} \u2192 v${selectedVersion}`),
          ]),
          renderDiff(diff),
        ])
      );
    } catch (err) {
      renderError(inner, `Failed to compare snapshots: ${err.message}`);
    }
  }
}

function miniStat(value, label) {
  return h("div", { style: { textAlign: "center" } }, [
    h("div", { className: "mono", style: { fontSize: "var(--font-size-lg)", fontWeight: "600" } }, String(value)),
    h("div", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" } }, label),
  ]);
}
