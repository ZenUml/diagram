---
name: draw
description: Use when a visual model would help explain or communicate a request, even if the user does not explicitly ask for a diagram. Useful for code module dependencies, call chains, architecture, workflows, state transitions, data models, sequence flows, and other relationships.
---

# Draw

Use this skill when a visual model would clearly improve understanding, including requests about dependencies, call chains, architecture, workflows, state transitions, data models, or other relationships.

## Choose the Mermaid type

- Use `zenuml` by default for sequence diagrams and interaction flows unless the user explicitly asks for Mermaid's native `sequenceDiagram` syntax.
- Use `sequenceDiagram` only when the user explicitly requests it or provides existing `sequenceDiagram` source that should be preserved.
- Use `flowchart` for process flow, branching logic, decision trees, or procedural steps.
- Use `classDiagram` for entities, classes, properties, methods, and relationships.
- Use `stateDiagram-v2` for lifecycle, status transitions, or finite state behavior.
- Use other Mermaid diagram types when the request clearly fits them, including `erDiagram`, `journey`, `gantt`, `gitGraph`, `mindmap`, `timeline`, `architecture`, `kanban`, `packet`, `quadrantChart`, `xychart`, `sankey`, `venn`, `ishikawa`, `block`, `treemap`, `treeView-beta`, `wardley-beta`, and the `C4*` family.

## Workflow

1. Draft Mermaid source from the user's request.
2. Run the packaged diagram draw CLI, which validates before writing local files.
3. If the CLI returns `ok: false`, repair the Mermaid once and run the draw CLI again.
4. After local rendering succeeds, call the `create_diagramly_diagram` tool with the Mermaid source.
5. If `create_diagramly_diagram` returns `diagramly.status: "created"`, return the standard local report and include the Diagramly.ai `PreviewUrl`.
6. If `create_diagramly_diagram` returns `diagramly.status: "authorization_required"`, first return the standard local report with `htmlPath`, `svgPath`, and `pngPath`, then ask whether the user wants to create a `https://diagramly.ai` online diagram for long-term storage and sharing.
   1. If the user confirms, call the `start_diagramly_auth` tool, show the returned `diagramly.loginUrl` (for example, `https://diagramly.ai/auth/device?code=ABCD-2345`), and immediately call the `complete_diagramly_auth` tool, waiting until it returns `diagramly.status: "authorized"` (user authorization succeeded) or reports an error/expiration.
   2. After authorization succeeds, call `create_diagramly_diagram` again with the same diagram source, then return a complete report again with `htmlPath`, `svgPath`, `pngPath`, and the Diagramly.ai `PreviewUrl`.

## Local draw CLI

Use the plugin-bundled draw CLI for local validation and rendering. Do not install Mermaid, `mermaid-core`, `@mermaid-js/mermaid-cli`, or other rendering dependencies dynamically.

Resolve the installed draw CLI path before invoking it. Do not assume the shell's current working directory is this skill directory.

```bash
DRAW_CLI="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/draw/scripts/draw.js}"
if [ -z "$DRAW_CLI" ] || [ ! -f "$DRAW_CLI" ]; then
  DRAW_CLI="$PWD/plugins/skills/draw/scripts/draw.js"
fi
if [ -z "$DRAW_CLI" ] || [ ! -f "$DRAW_CLI" ]; then
  DRAW_CLI="$(find "$HOME/.codex/plugins/cache" "$HOME/.codex/.tmp/marketplaces" -path "*/skills/draw/scripts/draw.js" -type f 2>/dev/null | sort | tail -n 1)"
fi
if [ -z "$DRAW_CLI" ] || [ ! -f "$DRAW_CLI" ]; then
  echo "diagram draw CLI not found in the installed plugin payload." >&2
  exit 1
fi
node "$DRAW_CLI"
```

Send one JSON object on stdin. The command has no arguments and always returns one JSON object on stdout. Omit `outputDir` for normal use; the renderer writes outputs under its default temp root (`/tmp/dv/<renderId>` on non-Windows platforms, or the OS temp directory on Windows). Only set `outputDir` when the user explicitly asks for a custom local output location.

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

Do not skip validation unless the user explicitly asks for raw Mermaid only.
Do not read repo source files or use ad hoc rendering commands as a fallback for normal diagram requests.
If the packaged runtime is missing, report the packaging error directly and stop.
If a plugin tool reports a runtime or startup failure, stop and surface that error clearly instead of exploring the repo.
Do not narrate internal exploration during healthy runs.

## Output rules

- After a successful local render, if the draw CLI result includes `displayText`, reproduce that `displayText` verbatim in every answer that reports local results.
- Always attempt Diagramly.ai creation after a successful local render by calling `create_diagramly_diagram`.
- If Diagramly.ai creation succeeds with a cached token, include the resulting `PreviewUrl` in the final answer.
- If Diagramly.ai creation returns `authorization_required`, do not block or replace the local report. Ask whether the user wants a `https://diagramly.ai` online diagram for long-term storage and sharing before starting authorization.
- Use this draw field order inside the boxed summary every time: `Status`, `Diagram Type`, `HTML Path`, `SVG Path`, `PNG Path`.
- Do not collapse multiple resources onto one line.
- Use `n/a` for unavailable fields instead of omitting them.
- Assume PNG export is on by default unless the caller explicitly disables it.
- Treat a Diagramly.ai authorization URL as an intermediate state after the user confirms they want the online diagram. Do not stop after returning it; wait with `complete_diagramly_auth` until authorization is confirmed, then retry `create_diagramly_diagram` to create the final Diagramly.ai diagram preview URL.
- If extra explanation is needed, put it after the block.
- If rendering fails, explain the first meaningful validation or render error and try at most one repair pass.

## Diagram drafting guidance

- Keep labels short and readable.
- Use stable node and state names instead of long prose.
- For `stateDiagram-v2`, make transitions explicit and use labels only when they add meaning.
- For `flowchart`, avoid deeply nested branching when a simpler path is possible.
- For `zenuml` and `sequenceDiagram`, define participants clearly before complex interactions.
- Prefer `zenuml` when the interaction includes nested calls, branching, loops, or code-like control flow.
- When the selected diagram type is `zenuml`, use the dedicated `zenuml` skill for syntax, examples, and drafting patterns.

## User intent heuristics

- Requests about API calls, request/response chains, or service interactions usually map to `zenuml` unless the user explicitly asks for `sequenceDiagram`.
- Requests about business processes, onboarding, or execution steps usually map to `flowchart`.
- Requests about domain models, schemas, or object relationships usually map to `classDiagram`.
- Requests about order states, job states, approval states, or lifecycle changes usually map to `stateDiagram-v2`.

## If the user provides Mermaid already

- Preserve their chosen diagram type unless it is clearly wrong.
- Validate first by running the draw CLI.
- If invalid, make the smallest viable fix before rendering.
