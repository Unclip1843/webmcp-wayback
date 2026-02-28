interface HtmlIndexEntry {
  index: number;
  url: string;
  source: string;
}

interface SnapshotData {
  url: string;
  title: string;
  snapshot: unknown;
  forms: Array<{
    action: string;
    method: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      label: string;
      placeholder: string;
      options: string[];
    }>;
    purpose: string;
  }>;
  interactiveElements: Array<{
    role: string;
    name: string;
    description: string;
  }>;
}

/**
 * Rewrite captured HTML for safe iframe rendering.
 * Strips scripts, rewrites internal links, adds mirror indicator.
 */
export function rewriteHtml(
  html: string,
  pageUrl: string,
  siteId: string,
  htmlIndex: HtmlIndexEntry[],
): string {
  // Build URL → index lookup
  const urlToIndex = new Map<string, number>();
  for (const entry of htmlIndex) {
    urlToIndex.set(entry.url, entry.index);
  }

  let baseUrl: URL | null = null;
  try {
    baseUrl = new URL(pageUrl);
  } catch {
    // Invalid URL, skip link rewriting
  }

  let result = html;

  // Strip dangerous elements
  result = result.replace(
    /<script[\s\S]*?<\/script>/gi,
    "<!-- script removed -->",
  );
  result = result.replace(/<script[^>]*\/>/gi, "<!-- script removed -->");
  result = result.replace(
    /<iframe[\s\S]*?<\/iframe>/gi,
    "<!-- iframe removed -->",
  );
  result = result.replace(/<iframe[^>]*\/>/gi, "<!-- iframe removed -->");
  result = result.replace(/<embed[^>]*\/?>/gi, "<!-- embed removed -->");
  result = result.replace(
    /<object[\s\S]*?<\/object>/gi,
    "<!-- object removed -->",
  );
  result = result.replace(/<base[^>]*\/?>/gi, "<!-- base removed -->");
  // Strip meta refresh
  result = result.replace(
    /<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*\/?>/gi,
    "<!-- meta refresh removed -->",
  );

  // Strip on* event handler attributes
  result = result.replace(
    /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    "",
  );

  // Replace javascript: URLs
  result = result.replace(
    /(?:href|src|action)\s*=\s*["']javascript:[^"']*["']/gi,
    'href="#"',
  );

  // Rewrite internal links
  if (baseUrl) {
    const origin = baseUrl.origin;

    // Rewrite href attributes
    result = result.replace(
      /(href\s*=\s*["'])([^"']+)(["'])/gi,
      (match, prefix: string, url: string, suffix: string) => {
        const rewritten = rewriteUrl(url, origin, siteId, urlToIndex);
        if (rewritten.missing) {
          return `${prefix}${rewritten.url}${suffix} data-mirror-missing="true" title="Page not captured"`;
        }
        if (rewritten.external) {
          return `${prefix}${rewritten.url}${suffix} target="_blank" rel="noopener"`;
        }
        return `${prefix}${rewritten.url}${suffix}`;
      },
    );

    // Rewrite form actions
    result = result.replace(
      /(action\s*=\s*["'])([^"']+)(["'])/gi,
      (match, prefix: string, url: string, suffix: string) => {
        return `${prefix}#${suffix}`;
      },
    );
  }

  // Inject mirror indicator bar at top of body
  const mirrorBar = `
<div style="position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa);z-index:999999"></div>
<div style="position:fixed;top:3px;right:8px;background:#1e293b;color:#94a3b8;font:11px/1.5 system-ui;padding:2px 8px;border-radius:0 0 4px 4px;z-index:999999;opacity:0.8">Mirror View</div>
`;

  result = result.replace(/(<body[^>]*>)/i, `$1${mirrorBar}`);

  // If no <body> tag, prepend
  if (!/<body/i.test(result)) {
    result = mirrorBar + result;
  }

  return result;
}

interface RewriteResult {
  url: string;
  missing?: boolean;
  external?: boolean;
}

function rewriteUrl(
  url: string,
  origin: string,
  siteId: string,
  urlToIndex: Map<string, number>,
): RewriteResult {
  // Skip anchors, data URIs, etc.
  if (
    url.startsWith("#") ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  ) {
    return { url };
  }

  let absoluteUrl: string;
  try {
    absoluteUrl = new URL(url, origin + "/").href;
  } catch {
    return { url };
  }

  // External link
  if (!absoluteUrl.startsWith(origin)) {
    return { url: absoluteUrl, external: true };
  }

  // Internal link — check if captured
  const idx = urlToIndex.get(absoluteUrl);
  if (idx !== undefined) {
    return { url: `/api/sites/${siteId}/mirror/${idx}` };
  }

  // Try without trailing slash
  const alt = absoluteUrl.endsWith("/")
    ? absoluteUrl.slice(0, -1)
    : absoluteUrl + "/";
  const altIdx = urlToIndex.get(alt);
  if (altIdx !== undefined) {
    return { url: `/api/sites/${siteId}/mirror/${altIdx}` };
  }

  // Internal but not captured
  return { url: "#", missing: true };
}

/**
 * Generate a structure view from Playwright's accessibility snapshot.
 * Renders the ARIA tree and forms as a self-contained HTML document.
 */
export function generateStructureView(snapshot: SnapshotData): string {
  const title = escapeHtml(snapshot.title || snapshot.url);
  const ariaHtml = renderAriaTree(snapshot.snapshot);
  const formsHtml = renderForms(snapshot.forms);
  const elementsHtml = renderInteractiveElements(snapshot.interactiveElements);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Structure: ${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f172a; color: #e2e8f0; font: 14px/1.6 'SF Mono', 'Fira Code', monospace; padding: 1.5rem; }
  h1 { font-size: 1rem; color: #94a3b8; margin-bottom: 1rem; font-weight: 500; }
  h2 { font-size: 0.85rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #1e293b; }
  .section { margin-bottom: 2rem; }
  .tree { padding-left: 0; }
  .tree-item { padding: 2px 0; white-space: nowrap; }
  .tree-indent { display: inline-block; width: 1.2em; color: #334155; }
  .role-badge { display: inline-block; padding: 0 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 6px; }
  .role-link { background: #1e3a5f; color: #60a5fa; }
  .role-button { background: #3b2f1e; color: #fb923c; }
  .role-textbox, .role-searchbox, .role-combobox { background: #1a3329; color: #4ade80; }
  .role-heading { background: #1e293b; color: #f1f5f9; }
  .role-navigation { background: #2d1b4e; color: #c084fc; }
  .role-img, .role-image { background: #3b1e3b; color: #f472b6; }
  .role-list, .role-listitem { background: #1e293b; color: #94a3b8; }
  .role-generic, .role-group { background: #1a1a2e; color: #64748b; }
  .name-text { color: #cbd5e1; }
  .form-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
  .form-method { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-right: 8px; }
  .form-method-get { background: #1a3329; color: #4ade80; }
  .form-method-post { background: #3b2f1e; color: #fb923c; }
  .form-action { color: #60a5fa; font-size: 12px; }
  .field-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; }
  .field-name { color: #60a5fa; min-width: 120px; }
  .field-type { color: #64748b; font-size: 11px; }
  .field-required { color: #f87171; font-size: 10px; }
  .el-row { padding: 3px 0; font-size: 13px; display: flex; gap: 8px; align-items: baseline; }
  .el-role { color: #64748b; font-size: 11px; min-width: 80px; }
  .el-name { color: #cbd5e1; }
  .empty { color: #475569; font-style: italic; }
</style>
</head>
<body>
<h1>${title}</h1>

<div class="section">
  <h2>Accessibility Tree</h2>
  ${ariaHtml}
</div>

<div class="section">
  <h2>Forms (${snapshot.forms.length})</h2>
  ${formsHtml}
</div>

<div class="section">
  <h2>Interactive Elements (${snapshot.interactiveElements.length})</h2>
  ${elementsHtml}
</div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAriaTree(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "string") {
    return '<p class="empty">No accessibility tree available</p>';
  }

  const lines = (snapshot as string).split("\n");
  const html: string[] = ['<div class="tree">'];

  for (const line of lines) {
    if (!line.trim()) continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1]!.length : 0;
    const depth = Math.floor(indent / 2);

    // Parse role and name: "- role "name"" or "- role:"
    const contentMatch = line
      .trim()
      .match(/^-\s+(\w+)(?:\s+"([^"]*)")?(?:\s*(.*))?/);

    if (contentMatch) {
      const role = contentMatch[1]!;
      const name = contentMatch[2] ?? "";
      const extra = contentMatch[3] ?? "";

      const roleClass = getRoleClass(role);
      const indentHtml = '<span class="tree-indent"></span>'.repeat(depth);
      const nameHtml = name
        ? ` <span class="name-text">${escapeHtml(name)}</span>`
        : "";
      const extraHtml = extra
        ? ` <span class="name-text" style="color:#64748b">${escapeHtml(extra)}</span>`
        : "";

      html.push(
        `<div class="tree-item">${indentHtml}<span class="role-badge ${roleClass}">${escapeHtml(role)}</span>${nameHtml}${extraHtml}</div>`,
      );
    } else {
      // Plain text line
      const indentHtml = '<span class="tree-indent"></span>'.repeat(depth);
      html.push(
        `<div class="tree-item">${indentHtml}<span class="name-text">${escapeHtml(line.trim())}</span></div>`,
      );
    }
  }

  html.push("</div>");
  return html.join("\n");
}

function getRoleClass(role: string): string {
  const map: Record<string, string> = {
    link: "role-link",
    button: "role-button",
    textbox: "role-textbox",
    searchbox: "role-searchbox",
    combobox: "role-combobox",
    heading: "role-heading",
    navigation: "role-navigation",
    nav: "role-navigation",
    img: "role-img",
    image: "role-image",
    list: "role-list",
    listitem: "role-listitem",
    group: "role-group",
    generic: "role-generic",
  };
  return map[role.toLowerCase()] ?? "role-generic";
}

function renderForms(forms: SnapshotData["forms"]): string {
  if (forms.length === 0) {
    return '<p class="empty">No forms found</p>';
  }

  return forms
    .map((form) => {
      const methodClass =
        form.method === "post" ? "form-method-post" : "form-method-get";
      const fieldsHtml = form.fields
        .map(
          (f) =>
            `<div class="field-row">
            <span class="field-name">${escapeHtml(f.name || "(unnamed)")}</span>
            <span class="field-type">${escapeHtml(f.type)}</span>
            ${f.required ? '<span class="field-required">required</span>' : ""}
            ${f.placeholder ? `<span style="color:#475569">${escapeHtml(f.placeholder)}</span>` : ""}
          </div>`,
        )
        .join("\n");

      return `<div class="form-card">
        <div style="margin-bottom:8px">
          <span class="form-method ${methodClass}">${escapeHtml(form.method)}</span>
          <span class="form-action">${escapeHtml(form.action || "/")}</span>
        </div>
        ${fieldsHtml || '<p class="empty">No fields</p>'}
      </div>`;
    })
    .join("\n");
}

function renderInteractiveElements(
  elements: SnapshotData["interactiveElements"],
): string {
  if (elements.length === 0) {
    return '<p class="empty">No interactive elements found</p>';
  }

  // Limit to first 100 to keep page manageable
  const limited = elements.slice(0, 100);
  const moreHtml =
    elements.length > 100
      ? `<p class="empty">...and ${elements.length - 100} more</p>`
      : "";

  return (
    limited
      .map(
        (el) =>
          `<div class="el-row">
          <span class="el-role">${escapeHtml(el.role)}</span>
          <span class="el-name">${escapeHtml(el.name || el.description || "(unnamed)")}</span>
        </div>`,
      )
      .join("\n") + moreHtml
  );
}
