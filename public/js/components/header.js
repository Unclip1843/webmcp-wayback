import { h, setContent } from "../utils.js";
import { subscribe, getState } from "../state.js";

export function renderHeader(container) {
  const urlBar = h("div", { className: "site-url-bar", style: { display: "none" } }, [
    h("span", {}, "\u{1F310}"),
    h("span", { className: "url-text" }),
    h("span", { className: "url-date" }),
  ]);

  const searchWrapper = h("div", { className: "search-wrapper" }, [
    h("span", { className: "search-icon" }, "\u{1F50D}"),
    h("input", {
      className: "input",
      type: "text",
      placeholder: "Search capabilities across all sites...",
    }),
    h("span", { className: "search-kbd" }, "/"),
  ]);

  setContent(container, searchWrapper, urlBar);

  // Update URL bar when site changes
  subscribe("currentSite", (site) => {
    if (site) {
      urlBar.style.display = "flex";
      urlBar.querySelector(".url-text").textContent = site.url;
      urlBar.querySelector(".url-date").textContent = site.crawledAt
        ? `@ ${new Date(site.crawledAt).toLocaleDateString()}`
        : "";
    } else {
      urlBar.style.display = "none";
    }
  });
}
