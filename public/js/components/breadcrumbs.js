import { h } from "../utils.js";

/**
 * Create a breadcrumb navigation element.
 * @param {Array<{label: string, path?: string}>} crumbs
 * @returns {HTMLElement}
 */
export function createBreadcrumbs(crumbs) {
  const nav = h("nav", { className: "breadcrumbs" });
  const items = [];

  for (let i = 0; i < crumbs.length; i++) {
    const crumb = crumbs[i];
    const isLast = i === crumbs.length - 1;

    if (i > 0) {
      items.push(h("span", { className: "breadcrumb-sep" }, "/"));
    }

    if (isLast || !crumb.path) {
      items.push(h("span", { className: "breadcrumb-current" }, crumb.label));
    } else {
      items.push(
        h("a", { href: `#${crumb.path}`, className: "breadcrumb-link" }, crumb.label)
      );
    }
  }

  for (const item of items) {
    nav.appendChild(item);
  }

  return nav;
}
