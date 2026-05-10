import { escapeHtml } from "./diagnostics.js";
import type { RenderRequest } from "./types.js";

export function buildHtmlDocument(
  svg: string,
  request: RenderRequest,
  options: { hasPng: boolean }
): string {
  const title = request.title || "Diagram Preview";
  const escapedSource = escapeHtml(request.source);
  const downloadLinks = [
    `<a class="button" href="diagram.svg" download="diagram.svg">Download SVG</a>`,
    options.hasPng
      ? `<a class="button" href="diagram.png" download="diagram.png">Download PNG</a>`
      : "",
    `<a class="button secondary" href="diagram.mmd" download="diagram.mmd">Download Mermaid</a>`
  ]
    .filter(Boolean)
    .join("\n          ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        padding: 24px;
        background: #f3f5f7;
        color: #17202a;
      }
      main {
        margin: 0;
      }
      .header {
        display: flex;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid #d8dee4;
        background: #17202a;
        color: #ffffff;
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
      }
      .button.secondary {
        background: #ffffff;
        color: #17202a;
      }
      .diagram {
        margin-top: 20px;
        overflow-x: auto;
        overflow-y: auto;
      }
      .diagram-stage {
        display: inline-block;
        min-width: 100%;
      }
      .diagram-stage > svg {
        display: block;
        width: auto;
        min-width: 100%;
        max-width: none;
        height: auto;
      }
      details {
        margin-top: 20px;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #0f172a;
        color: #e2e8f0;
        padding: 16px;
        border-radius: 12px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="header">
        <h1>${escapeHtml(title)}</h1>
        <div class="actions">
        ${downloadLinks}
        </div>
      </div>
      <div class="diagram">
        <div class="diagram-stage">
          ${svg}
        </div>
      </div>
      <details>
        <summary>Mermaid Source</summary>
        <pre>${escapedSource}</pre>
      </details>
    </main>
  </body>
</html>
`;
}
