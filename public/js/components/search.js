import { h, debounce } from "../utils.js";

/**
 * Creates a search input with debounced callback
 * @param {string} placeholder
 * @param {(value: string) => void} onChange
 * @param {number} delay
 * @returns {HTMLElement}
 */
export function createSearchInput(placeholder, onChange, delay = 250) {
  const wrapper = h("div", { className: "search-wrapper" }, [
    h("span", { className: "search-icon" }, "\u{1F50D}"),
    h("input", {
      className: "input",
      type: "text",
      placeholder,
    }),
  ]);

  const input = wrapper.querySelector("input");
  const debouncedChange = debounce(onChange, delay);

  input.addEventListener("input", () => {
    debouncedChange(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      onChange("");
      input.blur();
    }
  });

  return wrapper;
}
