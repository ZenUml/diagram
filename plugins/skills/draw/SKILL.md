---
name: draw
description: Use when a visual model would help explain or communicate a request, even if the user does not explicitly ask for a diagram. Useful for code module dependencies, call chains, architecture, workflows, state transitions, data models, sequence flows, and other relationships.
---

# Draw

Create Mermaid diagrams, validate them, and render local `htmlPath`, `svgPath`, and `pngPath` outputs. Diagramly.ai is an optional cloud upload path for users who want a shareable or long-lived online diagram after local rendering succeeds.

## Core flow

1. Select the Mermaid type from the request.
2. Draft Mermaid source.
3. Run the packaged draw CLI for local validation and rendering.
4. If the CLI returns `ok: false`, repair the Mermaid once and run the draw CLI again.
5. If local rendering succeeds, return the local render report using the CLI-provided `displayText` when present.
6. After reporting local files, tell the user that Diagramly.ai upload is available for sharing and long-term storage.
7. Only create a Diagramly.ai online diagram when the user asks for upload, sharing, saving online, a preview URL, or confirms the offered option.

Do not skip local validation unless the user explicitly asks for raw Mermaid only. Do not attempt Diagramly.ai upload if local rendering failed.

## Local renderer

The packaged draw CLI is the required local renderer. It validates Mermaid before writing files, renders SVG/HTML, exports PNG by default, and returns one JSON object on stdout. Do not install Mermaid, `mermaid-core`, `@mermaid-js/mermaid-cli`, or other rendering dependencies dynamically.

Resolve the installed CLI path before invoking it. Do not assume the shell's current working directory is this skill directory. Search in this order:

1. `$CLAUDE_PLUGIN_ROOT/skills/draw/scripts/draw.js`, when `CLAUDE_PLUGIN_ROOT` is set.
2. `plugins/skills/draw/scripts/draw.js` under the current repository, when working from the source tree.
3. The installed Codex plugin cache, such as `~/.codex/plugins/cache` or `~/.codex/.tmp/marketplaces`.

If the packaged draw CLI or runtime is missing, report the packaging error directly and stop. If a plugin tool reports a runtime or startup failure, stop and surface that error clearly instead of exploring the repo.

Invoke the CLI with no command-line arguments and send one JSON object on stdin. Omit `outputDir` for normal use; the renderer writes outputs under its default temp root (`/tmp/dv/<renderId>` on non-Windows platforms, or the OS temp directory on Windows). Only set `outputDir` when the user explicitly asks for a custom local output location.

Input shape:

```json
{
  "source": "flowchart TD\nA-->B",
  "title": "Optional title",
  "theme": "default",
  "renderId": "example"
}
```

Output shape:

```json
{
  "ok": true,
  "diagramType": "flowchart",
  "renderId": "example",
  "displayText": "...",
  "htmlPath": "...",
  "svgPath": "...",
  "pngPath": "...",
  "diagnostics": []
}
```

## Local report contract

- After a successful local render, if the draw CLI result includes `displayText`, reproduce that `displayText` verbatim in every answer that reports local results.
- Use this field order inside the boxed summary every time: `Status`, `Diagram Type`, `HTML Path`, `SVG Path`, `PNG Path`.
- Do not collapse multiple resources onto one line.
- Use `n/a` for unavailable fields instead of omitting them.
- Assume PNG export is on by default unless the caller explicitly disables it.
- Append diagnostics after the boxed summary only when present; do not put `Diagnostics` inside the box.
- If extra explanation is needed, put it after the boxed summary.
- If rendering fails after one repair pass, explain the first meaningful validation or render error.

Do not narrate internal exploration during healthy runs. Do not read repo source files or use ad hoc rendering commands as a fallback for normal diagram requests.

## Optional Diagramly.ai upload

Use the Diagramly.ai MCP tools only for optional cloud upload. They do not validate or render the local diagram; they upload the already-rendered Mermaid source to `https://diagramly.ai` so the user can save or share an online preview.

- `create_diagramly_diagram`: creates the Diagramly.ai online diagram from Mermaid source when a cached token is available, or returns `diagramly.status: "authorization_required"` when sign-in is needed.
- `start_diagramly_auth`: starts Diagramly.ai device authorization and returns `diagramly.loginUrl`.
- `complete_diagramly_auth`: waits for the pending device authorization to complete.

Upload flow:

1. Call `create_diagramly_diagram` only after local rendering succeeds and the user asks for or confirms online upload.
2. If it returns `diagramly.status: "created"`, include the Diagramly.ai `PreviewUrl` with the local report.
3. If it returns `diagramly.status: "authorization_required"`, keep the local report intact, call `start_diagramly_auth`, show the returned `diagramly.loginUrl`, then call `complete_diagramly_auth`.
4. If `complete_diagramly_auth` returns `diagramly.status: "authorized"`, retry `create_diagramly_diagram` with the same Mermaid source and include the final `PreviewUrl`.
5. If authorization expires or fails, report that Diagramly.ai upload did not complete; do not treat the local render as failed.

## Diagram type selection

- Use `zenuml` by default for sequence diagrams, API calls, request/response chains, service interactions, and other interaction flows unless the user explicitly asks for Mermaid's native `sequenceDiagram` syntax.
- Use `sequenceDiagram` only when the user explicitly requests it or provides existing `sequenceDiagram` source that should be preserved.
- Use `flowchart` for process flow, branching logic, decision trees, business workflows, onboarding, or procedural steps.
- Use `classDiagram` for entities, classes, schemas, properties, methods, and relationships.
- Use `stateDiagram-v2` for lifecycle, order states, job states, approval states, status transitions, or finite state behavior.
- Use other Mermaid diagram types when the request clearly fits them, including `erDiagram`, `journey`, `gantt`, `gitGraph`, `mindmap`, `timeline`, `architecture`, `kanban`, `packet`, `quadrantChart`, `xychart`, `sankey`, `venn`, `ishikawa`, `block`, `treemap`, `treeView-beta`, `wardley-beta`, and the `C4*` family.

## Drafting guidance

- Keep labels short and readable.
- Use stable node and state names instead of long prose.
- For `stateDiagram-v2`, make transitions explicit and use labels only when they add meaning.
- For `flowchart`, avoid deeply nested branching when a simpler path is possible.
- For `zenuml` and `sequenceDiagram`, define participants clearly before complex interactions.
- Prefer `zenuml` when the interaction includes nested calls, branching, loops, or code-like control flow.
- When the selected diagram type is `zenuml`, use the dedicated `zenuml` skill for syntax, examples, and drafting patterns.

## Existing Mermaid

- Preserve the user's chosen diagram type unless it is clearly wrong.
- Validate first by running the draw CLI.
- If invalid, make the smallest viable fix before rendering.
