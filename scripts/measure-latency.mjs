import { performance } from "node:perf_hooks";

import { validateMermaid, renderMermaid } from "../packages/mermaid-core/dist/index.js";

const source = `sequenceDiagram
Alice->>Bob: hello
Bob-->>Alice: hi`;
const runId = Date.now().toString();

async function measure(name, fn) {
  const startedAt = performance.now();
  const result = await fn();
  const elapsedMs = performance.now() - startedAt;
  return {
    name,
    elapsedMs,
    ok: Boolean(result?.ok)
  };
}

const checks = [
  await measure("validateMermaid", () => validateMermaid(source)),
  await measure("validateMermaid(cached)", () => validateMermaid(source)),
  await measure("renderMermaid(html)", () =>
    renderMermaid({ source, format: "html", renderId: `latency-measure-html-${runId}` })
  ),
  await measure("renderMermaid(html, cached)", () =>
    renderMermaid({ source, format: "html", renderId: `latency-measure-html-${runId}` })
  ),
  await measure("renderMermaid(png)", () =>
    renderMermaid({
      source,
      format: "png",
      exportPng: true,
      renderId: `latency-measure-png-${runId}`
    })
  ),
  await measure("renderMermaid(png, cached)", () =>
    renderMermaid({
      source,
      format: "png",
      exportPng: true,
      renderId: `latency-measure-png-${runId}`
    })
  )
];

console.log(JSON.stringify(checks, null, 2));
