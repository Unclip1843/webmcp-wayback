import { h } from "../utils.js";

/**
 * Build a URL-hierarchy tree from flat page list
 * @param {Array<{url: string, title: string}>} pages
 * @returns {HTMLElement}
 */
export function createTreeView(pages) {
  if (!pages?.length) {
    return h("div", { style: { color: "var(--text-muted)", fontSize: "var(--font-size-sm)" } }, "No pages discovered.");
  }

  // Build tree structure from URL paths
  const root = { children: new Map(), pages: [] };

  for (const page of pages) {
    let url;
    try {
      url = new URL(page.url);
    } catch {
      continue;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    let node = root;
    for (const seg of segments) {
      if (!node.children.has(seg)) {
        node.children.set(seg, { children: new Map(), pages: [] });
      }
      node = node.children.get(seg);
    }
    node.pages.push(page);
    if (segments.length === 0) {
      root.pages.push(page);
    }
  }

  return h("div", { className: "page-tree" }, renderTreeNode(root, "/", 0));
}

function renderTreeNode(node, path, depth) {
  const elements = [];

  // Render pages at this level
  for (const page of node.pages) {
    elements.push(
      h("div", { className: "tree-node" }, [
        h("div", { className: "tree-node-header" }, [
          h("span", {}, "\u{1F4C4}"),
          h("span", { className: "tree-node-url" }, page.title || page.url),
        ]),
      ])
    );
  }

  // Render child directories
  for (const [segment, child] of node.children) {
    const childPath = `${path}${segment}/`;
    const totalPages = countPages(child);
    const childrenContainer = h("div", { className: "tree-node-children" });
    const childElements = renderTreeNode(child, childPath, depth + 1);
    childrenContainer.append(...childElements);

    const header = h(
      "div",
      {
        className: "tree-node-header",
        onClick: () => {
          childrenContainer.classList.toggle("open");
          header.querySelector(".chevron")?.classList.toggle("open");
        },
      },
      [
        h("span", { className: "chevron expandable-header" }, "\u25B6"),
        h("span", {}, "\u{1F4C1}"),
        h("span", { className: "tree-node-url" }, `/${segment}`),
        h("span", { className: "tree-node-count" }, `${totalPages}`),
      ]
    );

    elements.push(
      h("div", { className: "tree-node" }, [header, childrenContainer])
    );
  }

  return elements;
}

function countPages(node) {
  let count = node.pages.length;
  for (const child of node.children.values()) {
    count += countPages(child);
  }
  return count;
}
