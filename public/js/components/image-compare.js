import { h } from "../utils.js";

/**
 * Create a comparison widget for two images.
 * @param {string} img1Url
 * @param {string} img2Url
 * @param {"side-by-side"|"slider"|"onion"} mode
 * @returns {HTMLElement}
 */
export function createCompare(img1Url, img2Url, mode = "side-by-side") {
  if (mode === "side-by-side") return createSideBySide(img1Url, img2Url);
  if (mode === "slider") return createSlider(img1Url, img2Url);
  return createOnion(img1Url, img2Url);
}

function createSideBySide(img1Url, img2Url) {
  return h("div", { className: "compare-side-by-side" }, [
    h("div", { className: "compare-panel" }, [
      h("div", { className: "compare-label" }, "Before"),
      h("img", { src: img1Url, className: "compare-img" }),
    ]),
    h("div", { className: "compare-panel" }, [
      h("div", { className: "compare-label" }, "After"),
      h("img", { src: img2Url, className: "compare-img" }),
    ]),
  ]);
}

function createSlider(img1Url, img2Url) {
  const container = h("div", { className: "compare-slider" });
  const img1 = h("img", { src: img1Url, className: "compare-img compare-slider-img" });
  const img2 = h("img", { src: img2Url, className: "compare-img compare-slider-img" });
  const clip = h("div", { className: "compare-slider-clip" }, [img1]);
  const divider = h("div", { className: "compare-slider-divider" }, [
    h("div", { className: "compare-slider-handle" }),
  ]);

  container.appendChild(img2);
  container.appendChild(clip);
  container.appendChild(divider);

  let dragging = false;

  function setPosition(x) {
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    clip.style.width = `${pct * 100}%`;
    divider.style.left = `${pct * 100}%`;
  }

  divider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
  });

  document.addEventListener("mousemove", (e) => {
    if (dragging) setPosition(e.clientX);
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });

  container.addEventListener("click", (e) => setPosition(e.clientX));

  // Set initial position to 50%
  requestAnimationFrame(() => {
    clip.style.width = "50%";
    divider.style.left = "50%";
  });

  return container;
}

function createOnion(img1Url, img2Url) {
  const img1 = h("img", { src: img1Url, className: "compare-img" });
  const img2 = h("img", { src: img2Url, className: "compare-img compare-onion-top" });

  const slider = h("input", {
    type: "range",
    min: "0",
    max: "100",
    value: "50",
    className: "compare-onion-slider",
    onInput: (e) => {
      img2.style.opacity = String(parseInt(e.target.value, 10) / 100);
    },
  });

  img2.style.opacity = "0.5";

  return h("div", { className: "compare-onion" }, [
    h("div", { className: "compare-onion-wrap" }, [img1, img2]),
    h("div", { className: "compare-onion-controls" }, [
      h("span", {}, "Before"),
      slider,
      h("span", {}, "After"),
    ]),
  ]);
}
