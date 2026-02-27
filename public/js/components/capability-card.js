import { h } from "../utils.js";
import { typeBadge, authBadge, confidenceBar } from "./badge.js";

/**
 * Render a capability card with expandable I/O
 * @param {object} cap — capability object
 * @returns {HTMLElement}
 */
export function capabilityCard(cap) {
  const ioSection = h("div", { className: "capability-io" });

  const header = h(
    "div",
    {
      className: "capability-card-header",
      onClick: () => {
        ioSection.classList.toggle("open");
        header.querySelector(".chevron").classList.toggle("open");
      },
    },
    [
      h("span", { className: "chevron" }, "\u25B6"),
      typeBadge(cap.type),
      h("span", { className: "cap-name" }, cap.name),
      cap.requiresAuth ? authBadge() : null,
      confidenceBar(cap.confidence),
      h("span", { className: "cap-page" }, cap.page ?? ""),
    ]
  );

  // Build I/O details
  const ioChildren = [];

  if (cap.description) {
    ioChildren.push(
      h("p", { style: { color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-3)" } }, cap.description)
    );
  }

  if (cap.inputs?.length) {
    ioChildren.push(
      h("div", { className: "io-section" }, [
        h("div", { className: "io-section-title" }, "Inputs"),
        ...cap.inputs.map((p) =>
          h("div", { className: "io-param" }, [
            h("span", { className: "io-param-name" }, p.name),
            h("span", { className: "io-param-type" }, p.type),
            p.required
              ? h("span", { className: "io-param-required" }, "required")
              : null,
            p.description
              ? h("span", { style: { color: "var(--text-secondary)" } }, `\u2014 ${p.description}`)
              : null,
          ])
        ),
      ])
    );
  }

  if (cap.outputs?.length) {
    ioChildren.push(
      h("div", { className: "io-section" }, [
        h("div", { className: "io-section-title" }, "Outputs"),
        ...cap.outputs.map((p) =>
          h("div", { className: "io-param" }, [
            h("span", { className: "io-param-name" }, p.name),
            h("span", { className: "io-param-type" }, p.type),
            p.description
              ? h("span", { style: { color: "var(--text-secondary)" } }, `\u2014 ${p.description}`)
              : null,
          ])
        ),
      ])
    );
  }

  if (ioChildren.length === 0) {
    ioChildren.push(
      h("p", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-sm)" } }, "No additional details available.")
    );
  }

  ioSection.append(...ioChildren);

  return h("div", { className: "capability-card" }, [header, ioSection]);
}
