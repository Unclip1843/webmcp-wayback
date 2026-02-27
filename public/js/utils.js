/** @param {string} str */
export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** @param {string} tag @param {Record<string,string>} attrs @param {string|Node|(string|Node)[]} children */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") {
      el.className = v;
    } else if (k.startsWith("on")) {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "style" && typeof v === "object") {
      Object.assign(el.style, v);
    } else {
      el.setAttribute(k, v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child == null) continue;
    if (typeof child === "string" || typeof child === "number") {
      el.appendChild(document.createTextNode(String(child)));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

/** Format ISO date to short display */
export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format ISO date with time */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a number with commas */
export function formatNumber(n) {
  return (n ?? 0).toLocaleString();
}

/** Get CSS variable for capability type */
export function capTypeColor(type) {
  const map = {
    form: "var(--cap-form)",
    search: "var(--cap-search)",
    navigation: "var(--cap-navigation)",
    api: "var(--cap-api)",
    action: "var(--cap-action)",
    download: "var(--cap-download)",
  };
  return map[type] ?? "var(--text-muted)";
}

/** Debounce a function */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Set inner content safely */
export function setContent(el, ...children) {
  el.replaceChildren(...children);
}

/** Render loading skeletons */
export function renderSkeletons(container, count = 4) {
  const frags = [];
  for (let i = 0; i < count; i++) {
    frags.push(h("div", { className: "skeleton skeleton-card" }));
  }
  setContent(container, ...frags);
}

/** Render error state */
export function renderError(container, message, onRetry) {
  setContent(
    container,
    h("div", { className: "error-state" }, [
      h("p", {}, message),
      onRetry
        ? h("button", { className: "retry-btn", onClick: onRetry }, "Retry")
        : null,
    ])
  );
}

/** Render empty state */
export function renderEmpty(container, icon, title, description) {
  setContent(
    container,
    h("div", { className: "empty-state" }, [
      h("div", { className: "empty-state-icon" }, icon),
      h("div", { className: "empty-state-title" }, title),
      description ? h("p", {}, description) : null,
    ])
  );
}
