import { h, formatDate } from "../utils.js";

/**
 * Create a timeline slider that scrubs through site versions.
 * @param {Array<{version: number, date: string, pageCount: number, capabilityCount: number, screenshotCount: number}>} versions
 * @param {number} selectedVersion
 * @param {(version: number) => void} onChange
 * @returns {HTMLElement}
 */
export function createTimelineSlider(versions, selectedVersion, onChange) {
  if (versions.length === 0) {
    return h("div", { className: "empty-state" }, "No versions available");
  }

  const track = h("div", { className: "slider-track" });
  const preview = h("div", { className: "slider-preview" });
  const container = h("div", { className: "timeline-slider-container" }, [track, preview]);

  function render() {
    const markers = [];
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const isActive = v.version === selectedVersion;
      const pct = versions.length === 1 ? 50 : (i / (versions.length - 1)) * 100;

      if (i > 0) {
        const prevPct = versions.length === 1 ? 50 : ((i - 1) / (versions.length - 1)) * 100;
        const line = h("div", { className: "slider-line", style: {
          left: `${prevPct}%`,
          width: `${pct - prevPct}%`,
        }});
        markers.push(line);
      }

      const marker = h("div", {
        className: `slider-marker${isActive ? " active" : ""}`,
        style: { left: `${pct}%` },
        onClick: () => {
          selectedVersion = v.version;
          onChange(v.version);
          render();
        },
      }, [
        h("div", { className: "slider-marker-dot" }),
        h("div", { className: "slider-marker-label" }, `v${v.version}`),
        h("div", { className: "slider-marker-date" }, formatDate(v.date)),
      ]);

      markers.push(marker);
    }

    track.replaceChildren(...markers);

    // Update preview
    const current = versions.find((v) => v.version === selectedVersion);
    if (current) {
      preview.replaceChildren(
        h("div", { className: "slider-preview-row" }, [
          previewStat(String(current.capabilityCount), "Capabilities"),
          previewStat(String(current.pageCount), "Pages"),
          previewStat(String(current.screenshotCount), "Screenshots"),
        ])
      );
    }
  }

  // Keyboard navigation
  container.setAttribute("tabindex", "0");
  container.addEventListener("keydown", (e) => {
    const idx = versions.findIndex((v) => v.version === selectedVersion);
    if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      selectedVersion = versions[idx - 1].version;
      onChange(selectedVersion);
      render();
    }
    if (e.key === "ArrowRight" && idx < versions.length - 1) {
      e.preventDefault();
      selectedVersion = versions[idx + 1].version;
      onChange(selectedVersion);
      render();
    }
  });

  render();
  return container;
}

function previewStat(value, label) {
  return h("div", { className: "slider-preview-stat" }, [
    h("div", { className: "mono", style: { fontSize: "var(--font-size-lg)", fontWeight: "600" } }, value),
    h("div", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-xs)" } }, label),
  ]);
}
