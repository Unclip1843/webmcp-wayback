import { h } from "../utils.js";
import { typeBadge } from "./badge.js";

/**
 * Compute diff between two site maps
 * @param {object} oldMap
 * @param {object} newMap
 * @returns {{added: object[], removed: object[], changed: object[]}}
 */
export function computeDiff(oldMap, newMap) {
  const oldCaps = new Map((oldMap?.capabilities ?? []).map((c) => [c.id, c]));
  const newCaps = new Map((newMap?.capabilities ?? []).map((c) => [c.id, c]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, cap] of newCaps) {
    if (!oldCaps.has(id)) {
      added.push(cap);
    } else {
      const old = oldCaps.get(id);
      const changes = findChanges(old, cap);
      if (changes.length > 0) {
        changed.push({ cap, changes });
      }
    }
  }

  for (const [id, cap] of oldCaps) {
    if (!newCaps.has(id)) {
      removed.push(cap);
    }
  }

  return { added, removed, changed };
}

function findChanges(oldCap, newCap) {
  const changes = [];
  const fields = ["name", "description", "type", "confidence", "requiresAuth", "page"];
  for (const f of fields) {
    if (JSON.stringify(oldCap[f]) !== JSON.stringify(newCap[f])) {
      changes.push({ field: f, oldVal: oldCap[f], newVal: newCap[f] });
    }
  }
  if (JSON.stringify(oldCap.inputs) !== JSON.stringify(newCap.inputs)) {
    changes.push({ field: "inputs", oldVal: "(changed)", newVal: "(changed)" });
  }
  if (JSON.stringify(oldCap.outputs) !== JSON.stringify(newCap.outputs)) {
    changes.push({ field: "outputs", oldVal: "(changed)", newVal: "(changed)" });
  }
  return changes;
}

/**
 * Render diff results
 * @param {{added: object[], removed: object[], changed: object[]}} diff
 * @returns {HTMLElement}
 */
export function renderDiff(diff) {
  const container = h("div", {});

  // Summary
  container.append(
    h("div", { className: "diff-summary" }, [
      h("div", { className: "diff-summary-card added" }, [
        h("div", { className: "diff-summary-value" }, `+${diff.added.length}`),
        h("div", { className: "diff-summary-label" }, "Added"),
      ]),
      h("div", { className: "diff-summary-card removed" }, [
        h("div", { className: "diff-summary-value" }, `-${diff.removed.length}`),
        h("div", { className: "diff-summary-label" }, "Removed"),
      ]),
      h("div", { className: "diff-summary-card changed" }, [
        h("div", { className: "diff-summary-value" }, `~${diff.changed.length}`),
        h("div", { className: "diff-summary-label" }, "Changed"),
      ]),
    ])
  );

  // Items
  const items = [];

  for (const cap of diff.added) {
    items.push(
      h("div", { className: "diff-item diff-added" }, [
        h("div", { className: "diff-item-header" }, [
          h("span", { className: "diff-item-label" }, "Added"),
          typeBadge(cap.type),
          h("span", { className: "diff-item-name" }, cap.name),
        ]),
        h("div", { className: "diff-item-detail" }, cap.description),
      ])
    );
  }

  for (const cap of diff.removed) {
    items.push(
      h("div", { className: "diff-item diff-removed" }, [
        h("div", { className: "diff-item-header" }, [
          h("span", { className: "diff-item-label" }, "Removed"),
          typeBadge(cap.type),
          h("span", { className: "diff-item-name" }, cap.name),
        ]),
        h("div", { className: "diff-item-detail" }, cap.description),
      ])
    );
  }

  for (const { cap, changes } of diff.changed) {
    items.push(
      h("div", { className: "diff-item diff-changed" }, [
        h("div", { className: "diff-item-header" }, [
          h("span", { className: "diff-item-label" }, "Changed"),
          typeBadge(cap.type),
          h("span", { className: "diff-item-name" }, cap.name),
        ]),
        h("div", { className: "diff-item-detail" },
          changes.map((c) =>
            h("div", { className: "diff-field-change" }, [
              h("span", { className: "diff-field-name" }, c.field),
              h("span", { className: "diff-field-old" }, String(c.oldVal)),
              h("span", {}, "\u2192"),
              h("span", { className: "diff-field-new" }, String(c.newVal)),
            ])
          )
        ),
      ])
    );
  }

  if (items.length === 0) {
    items.push(
      h("div", { className: "empty-state", style: { padding: "var(--space-5)" } }, [
        h("div", { className: "empty-state-title" }, "No changes detected"),
        h("p", { style: { color: "var(--text-secondary)" } }, "These two snapshots are identical."),
      ])
    );
  }

  container.append(h("div", { className: "diff-list" }, items));

  return container;
}
