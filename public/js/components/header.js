import { h, setContent } from "../utils.js";
import { subscribe } from "../state.js";
import { createBreadcrumbs } from "./breadcrumbs.js";

export function renderHeader(container) {
  const breadcrumbContainer = h("div", { className: "header-breadcrumbs" });

  const searchWrapper = h("div", { className: "search-wrapper" }, [
    h("span", { className: "search-icon" }, "\u{1F50D}"),
    h("input", {
      className: "input",
      type: "text",
      placeholder: "Search capabilities across all sites...",
    }),
    h("span", { className: "search-kbd" }, "/"),
  ]);

  setContent(container, breadcrumbContainer, searchWrapper);

  // Update breadcrumbs when state changes
  subscribe("breadcrumbs", (crumbs) => {
    if (crumbs && crumbs.length > 0) {
      setContent(breadcrumbContainer, createBreadcrumbs(crumbs));
    } else {
      setContent(breadcrumbContainer);
    }
  });
}
