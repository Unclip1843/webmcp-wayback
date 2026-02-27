import { h, formatDate } from "../utils.js";

/**
 * Create a horizontal timeline with clickable dots
 * @param {Array<{version: number, crawledAt: string}>} versions
 * @param {number|null} selectedVersion
 * @param {(version: number) => void} onSelect
 * @returns {HTMLElement}
 */
export function createTimeline(versions, selectedVersion, onSelect) {
  if (!versions.length) {
    return h("div", { className: "timeline-bar" }, [
      h("span", { style: { color: "var(--text-muted)" } }, "No snapshots available"),
    ]);
  }

  const dots = [];
  for (let i = 0; i < versions.length; i++) {
    const v = versions[i];
    const isActive = v.version === selectedVersion;
    const dot = h(
      "div",
      {
        className: `timeline-dot${isActive ? " active" : ""}`,
        onClick: () => onSelect(v.version),
        title: `v${v.version} — ${formatDate(v.crawledAt)}`,
      },
      [h("span", { className: "dot-label" }, `v${v.version}`)]
    );
    dots.push(dot);
    if (i < versions.length - 1) {
      dots.push(h("div", { className: "timeline-line" }));
    }
  }

  return h("div", { className: "timeline-bar" }, [
    h("span", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-sm)", flexShrink: "0" } }, "Snapshots:"),
    h("div", { className: "timeline-dots" }, dots),
  ]);
}
