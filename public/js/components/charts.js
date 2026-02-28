import { h } from "../utils.js";

const COLORS = [
  "#58a6ff", "#3fb950", "#bc8cff", "#f0883e",
  "#39d2c0", "#f85149", "#d29922", "#8b949e",
];

/**
 * Create an SVG bar chart.
 * @param {Array<{label: string, value: number}>} data
 * @param {{width?: number, height?: number, color?: string}} opts
 */
export function barChart(data, opts = {}) {
  const { width = 400, height = 200 } = opts;
  if (data.length === 0) return h("div", { className: "empty-state" }, "No data");

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(12, Math.min(40, (width - 40) / data.length - 4));
  const chartH = height - 40;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "chart-svg");
  svg.style.width = "100%";
  svg.style.maxWidth = `${width}px`;

  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * chartH;
    const x = 30 + i * (barWidth + 4);
    const y = chartH - barH + 10;

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", barWidth);
    rect.setAttribute("height", barH);
    rect.setAttribute("fill", COLORS[i % COLORS.length]);
    rect.setAttribute("rx", "2");

    const title = document.createElementNS(ns, "title");
    title.textContent = `${d.label}: ${d.value}`;
    rect.appendChild(title);
    svg.appendChild(rect);

    // Label
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", x + barWidth / 2);
    text.setAttribute("y", height - 4);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#8b949e");
    text.setAttribute("font-size", "10");
    text.textContent = d.label.length > 8 ? d.label.slice(0, 7) + "\u2026" : d.label;
    svg.appendChild(text);
  });

  return svg;
}

/**
 * Create an SVG line chart.
 * @param {Array<{label: string, value: number}>} data
 * @param {{width?: number, height?: number, color?: string}} opts
 */
export function lineChart(data, opts = {}) {
  const { width = 400, height = 200, color = "#58a6ff" } = opts;
  if (data.length < 2) return h("div", { className: "empty-state" }, "Need 2+ data points");

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartW = width - 50;
  const chartH = height - 40;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "chart-svg");
  svg.style.width = "100%";
  svg.style.maxWidth = `${width}px`;

  const points = data.map((d, i) => ({
    x: 40 + (i / (data.length - 1)) * chartW,
    y: 10 + chartH - (d.value / maxVal) * chartH,
  }));

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (i / 4) * chartH;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", "40");
    line.setAttribute("y1", y);
    line.setAttribute("x2", width - 10);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#21262d");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", "35");
    label.setAttribute("y", y + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("fill", "#656d76");
    label.setAttribute("font-size", "10");
    label.textContent = String(Math.round(maxVal * (1 - i / 4)));
    svg.appendChild(label);
  }

  // Area fill
  const areaPath = document.createElementNS(ns, "path");
  const areaD = `M${points[0].x},${10 + chartH} ${points.map((p) => `L${p.x},${p.y}`).join(" ")} L${points[points.length - 1].x},${10 + chartH} Z`;
  areaPath.setAttribute("d", areaD);
  areaPath.setAttribute("fill", color);
  areaPath.setAttribute("opacity", "0.1");
  svg.appendChild(areaPath);

  // Line
  const linePath = document.createElementNS(ns, "path");
  linePath.setAttribute("d", `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`);
  linePath.setAttribute("fill", "none");
  linePath.setAttribute("stroke", color);
  linePath.setAttribute("stroke-width", "2");
  svg.appendChild(linePath);

  // Dots + labels
  points.forEach((p, i) => {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", p.x);
    circle.setAttribute("cy", p.y);
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", color);
    const title = document.createElementNS(ns, "title");
    title.textContent = `${data[i].label}: ${data[i].value}`;
    circle.appendChild(title);
    svg.appendChild(circle);

    if (data.length <= 10) {
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", p.x);
      text.setAttribute("y", height - 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#8b949e");
      text.setAttribute("font-size", "10");
      text.textContent = data[i].label;
      svg.appendChild(text);
    }
  });

  return svg;
}

/**
 * Create an inline sparkline SVG.
 * @param {number[]} values
 * @param {{width?: number, height?: number, color?: string}} opts
 */
export function sparkline(values, opts = {}) {
  const { width = 80, height = 20, color = "#58a6ff" } = opts;
  if (values.length < 2) return h("span");

  const max = Math.max(...values, 1);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "sparkline");
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.style.verticalAlign = "middle";

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - (v / max) * (height - 2) - 1,
  }));

  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);

  return svg;
}
