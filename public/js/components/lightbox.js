import { h } from "../utils.js";

let overlay = null;
let images = [];
let currentIndex = 0;
let onKeyDown = null;

export function openLightbox(imgs, startIndex = 0) {
  images = imgs;
  currentIndex = startIndex;

  if (overlay) closeLightbox();

  const imgEl = h("img", { className: "lightbox-img" });
  const label = h("div", { className: "lightbox-label" });
  const counter = h("div", { className: "lightbox-counter" });

  const prevBtn = h("button", {
    className: "lightbox-arrow lightbox-prev",
    onClick: () => navigate(-1),
  }, "\u2039");

  const nextBtn = h("button", {
    className: "lightbox-arrow lightbox-next",
    onClick: () => navigate(1),
  }, "\u203A");

  overlay = h("div", { className: "lightbox-overlay", onClick: (e) => {
    if (e.target === overlay) closeLightbox();
  }}, [
    h("button", { className: "lightbox-close", onClick: closeLightbox }, "\u00D7"),
    prevBtn,
    h("div", { className: "lightbox-content" }, [imgEl, label, counter]),
    nextBtn,
  ]);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  function navigate(dir) {
    currentIndex = (currentIndex + dir + images.length) % images.length;
    update();
  }

  function update() {
    const img = images[currentIndex];
    imgEl.src = img.src;
    imgEl.alt = img.label || "";
    label.textContent = img.label || "";
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  }

  onKeyDown = (e) => {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navigate(-1);
    if (e.key === "ArrowRight") navigate(1);
  };
  document.addEventListener("keydown", onKeyDown);

  update();
}

export function closeLightbox() {
  if (!overlay) return;
  if (onKeyDown) {
    document.removeEventListener("keydown", onKeyDown);
    onKeyDown = null;
  }
  overlay.remove();
  overlay = null;
  images = [];
}
