import { h } from "../utils.js";

/**
 * Create a reusable version selector dropdown.
 * @param {Array<{version: number, crawledAt: string}>} versions
 * @param {string} currentVersion — e.g. "v2"
 * @param {(version: string) => void} onChange
 * @returns {HTMLElement}
 */
export function createVersionSelector(versions, currentVersion, onChange) {
  const select = h("select", {
    className: "mirror-page-select",
    onChange: (e) => onChange(e.target.value),
  });

  for (const v of versions) {
    const vStr = `v${v.version}`;
    const dateStr = v.crawledAt ? formatShortDate(v.crawledAt) : "";
    const label = dateStr ? `v${v.version} — ${dateStr}` : `v${v.version}`;
    const opt = h("option", { value: vStr }, label);
    if (vStr === currentVersion) opt.selected = true;
    select.appendChild(opt);
  }

  return select;
}

function formatShortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
