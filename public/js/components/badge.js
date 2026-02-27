import { h, escapeHtml } from "../utils.js";

/** Capability type badge */
export function typeBadge(type) {
  return h("span", { className: `badge badge-${type}` }, type);
}

/** HTTP method badge */
export function methodBadge(method) {
  const m = (method ?? "GET").toUpperCase();
  return h("span", { className: `badge badge-${m.toLowerCase()}` }, m);
}

/** Auth required badge */
export function authBadge() {
  return h("span", { className: "badge badge-auth" }, "auth required");
}

/** Confidence indicator */
export function confidenceBar(value) {
  const pct = Math.round((value ?? 0) * 100);
  const color =
    pct >= 80
      ? "var(--color-success)"
      : pct >= 50
      ? "var(--color-warning)"
      : "var(--color-danger)";

  return h("span", { className: "flex items-center gap-2" }, [
    h("span", { className: "confidence-bar" }, [
      h("span", {
        className: "confidence-bar-fill",
        style: { width: `${pct}%`, background: color },
      }),
    ]),
    h("span", { className: "mono", style: { fontSize: "var(--font-size-xs)", color: "var(--text-muted)" } }, `${pct}%`),
  ]);
}
