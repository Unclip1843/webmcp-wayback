import { h } from "../utils.js";

/**
 * Create a sortable data table
 * @param {object} config
 * @param {Array<{key: string, label: string, render?: (row: any) => string|Node}>} config.columns
 * @param {Array<object>} config.data
 * @param {string} [config.defaultSort]
 * @param {boolean} [config.defaultAsc]
 * @returns {HTMLElement}
 */
export function createTable({ columns, data, defaultSort, defaultAsc = true }) {
  let sortKey = defaultSort ?? columns[0]?.key;
  let sortAsc = defaultAsc;

  const container = h("div", {});

  function render() {
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = typeof aVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });

    const thead = h("thead", {}, [
      h(
        "tr",
        {},
        columns.map((col) => {
          const arrow =
            sortKey === col.key ? (sortAsc ? " \u25B2" : " \u25BC") : "";
          return h(
            "th",
            {
              onClick: () => {
                if (sortKey === col.key) {
                  sortAsc = !sortAsc;
                } else {
                  sortKey = col.key;
                  sortAsc = true;
                }
                render();
              },
            },
            [
              h("span", {}, col.label),
              h("span", { className: "sort-arrow" }, arrow),
            ]
          );
        })
      ),
    ]);

    const tbody = h(
      "tbody",
      {},
      sorted.map((row) =>
        h(
          "tr",
          {},
          columns.map((col) => {
            const content = col.render ? col.render(row) : String(row[col.key] ?? "");
            return h("td", {}, typeof content === "string" ? content : [content]);
          })
        )
      )
    );

    const table = h("table", { className: "data-table" }, [thead, tbody]);
    container.replaceChildren(table);
  }

  render();
  return container;
}
