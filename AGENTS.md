# Repository Guidelines

## Project Structure & Module Organization
- `packages/mermaid-core` contains Mermaid validation and rendering.
- `packages/diagramly-ai-mcp` exposes Diagramly.ai online-service MCP tools over stdio.
- `plugins/` is the shared installable Codex and Claude Code marketplace plugin root.
- `plugins/skills/` contains the plugin skill source.

## Build, Test, and Development Commands
- `pnpm build` builds all workspace packages.
- `pnpm check` runs TypeScript no-emit checks for all packages.
- `pnpm package` rebuilds the monorepo, syncs the plugin version from root `package.json`, and refreshes `plugins/runtime/`.
- `pnpm package:major`, `pnpm package:minor`, and `pnpm package:patch` bump the selected version segment before packaging.
- `pnpm smoke:cloud-preview` builds and verifies mocked Diagramly.ai preview creation plus pending device authorization.
- `pnpm dev:diagramly-ai` builds and starts the Diagramly.ai MCP server.

## Coding Style & Naming Conventions
- Use TypeScript with small, focused modules and minimal diffs.
- Prefer ASCII unless an existing file already uses non-ASCII content.
- Keep public return shapes stable across `mermaid-core`.
- Use `draw` as the shared plugin skill name.
- Keep `README.md` strictly user-facing and concise. Put developer workflows, packaging details, environment variables, release notes, and handoff nuance here.

## Plugin Workflow Notes
- Mermaid is the only supported diagram engine in this repo.
- Pure TUI is the primary UX: Codex and Claude Code packaged draw CLIs return local `htmlPath`, `svgPath`, and `pngPath` outputs; after local success, `@diagramly-vibe/diagramly.ai` can create a Diagramly.ai online diagram on request and returns a `previewUrl` only when `diagramly.status: "created"`.
- Keep the render summary text in a stable ASCII panel with fixed field order; do not drift back to ad hoc single-line resource dumps. Do not put `Diagnostics` inside boxed summaries; append diagnostics after the box only when present.
- When plugin-facing files change, rerun `pnpm package` before testing.
- Skill edits happen directly under `plugins/skills/`; there is no separate skill copy step during packaging.
- Codex local marketplace testing uses `plugins/`.

## System Architecture
- The repo is one shared Mermaid runtime with thin host adapters.
- `packages/mermaid-core` owns validation and rendering. It infers diagram type, validates Mermaid, renders SVG as canonical output, optionally exports PNG, writes deterministic output directories, and returns structured diagnostics.
- `packages/diagramly-ai-mcp` owns Diagramly.ai device-token caching, pending authorization, and remote diagram creation.
- Host metadata lives under `plugins/`. It should stay limited to plugin metadata, bootstrapping, packaged runtime payloads, and host-specific skills.
- Default runtime flow is: draft Mermaid -> validate/render local files through `skills/draw/scripts/draw.js` -> return local files first -> tell the user Diagramly.ai upload is available for long-term storage and sharing -> only on request or confirmation, call `create_diagramly_diagram` -> if it returns `diagramly.status: "authorization_required"`, call `start_diagramly_auth`, show `diagramly.loginUrl`, call `complete_diagramly_auth` until `diagramly.status: "authorized"` or error/expiration, then retry `create_diagramly_diagram`.
- `renderId` reuses unchanged local render outputs. For Diagramly.ai previews, `previewId` is the created diagram id.
- The installable plugin root must ship plugin metadata, `runtime/`, and `skills/`.

## Current Status
- `mermaid-core`, the packaged draw CLI, and `diagramly-ai-mcp` are working together for the primary TUI flow.
- `mermaid-core` has been split into smaller internal modules; avoid collapsing new logic back into large single-file entrypoints.
- For Codex and Claude Code, local draw is exposed as the fixed stdin/stdout skill CLI. `create_diagramly_diagram` and `complete_diagramly_auth` are exposed through `@diagramly-vibe/diagramly.ai`.
- Validation uses Mermaid's internal parser first for `sequenceDiagram`, `flowchart`, `classDiagram`, and `stateDiagram-v2`, with Mermaid CLI fallback elsewhere.
- Rendering uses `@mermaid-js/mermaid-cli`, supports SVG/HTML, exports PNG by default, and returns local file paths and structured diagnostics.
- Diagramly.ai preview creation uses cached device authorization tokens under `~/.diagramly-vibe/auth.json` by default and calls `/api/device-auth/diagrams` without consuming credits.
- Render outputs are reused when the same `renderId` is called again with unchanged Mermaid source and render options.
- `zenuml` is supported through Mermaid CLI's external registration, and standalone SVG output now embeds the CSS it needs.
- `scripts/package-plugins.mjs` builds one shared staging runtime, prunes it, then copies it into `plugins/` so installs stay self-contained without running dependency installation per adapter.
- Runtime pruning includes removal of `runtime/node_modules/.modules.yaml` and `runtime/pnpm-lock.yaml`.
- The packaged plugin runtime is still roughly `189M`.
- `plugins/` is the shared installable Codex and Claude Code marketplace plugin root.
- `plugins/runtime` must ship with the installable plugin root; without it, Codex can list the plugin but the packaged draw CLI and Diagramly.ai MCP startup fail.
- The shared skill name is `draw`.
- `pnpm package` reads `.env` / `.env.local` and packages `DIAGRAMLY_BASE_URL` or `DIAGRAMLY_API_BASE_URL` into the plugin runtime; runtime environment variables still override packaged values.
- Diagramly.ai tokens are cached at `~/.diagramly-vibe/auth.json` by default. `DIAGRAMLY_TOKEN_CACHE`, `DIAGRAMLY_AUTH_WAIT_SECONDS`, and `DIAGRAMLY_AUTH_COMPLETE_WAIT_SECONDS` can override auth behavior for testing.

## Plugin Install Notes
- Codex does not currently document a non-interactive `plugins install` CLI subcommand; use `/plugins` in Codex CLI.
- Verified Codex local install flow:
  - `pnpm package`
  - ensure Codex plugin support is enabled in user config
  - start or restart Codex in the repo
  - rely on `.agents/plugins/marketplace.json`
  - open `/plugins`
  - install `diagram`
- Keep the installed plugin copy in sync after plugin-facing changes. For runtime or skill-content edits, close Codex sessions, run `pnpm reset:codex-plugin-cache`, then restart Codex so it reloads from the local marketplace path.
- Reinstall from `/plugins` after plugin identity, manifest shape, skill names, or MCP server definitions change, or when Codex reports broken plugin details. `pnpm reset:codex-plugin-cache` only removes cached plugin files; it does not uninstall plugin configuration.
- Verified Claude Code local install flow:
  - `pnpm package`
  - `claude plugin marketplace add ./`
  - `claude plugin install diagram@diagram`
- Claude Code rejects bare `.` as an invalid marketplace source; use `./` for the repository root marketplace.
- For GitHub marketplace installs, prefer `claude plugin marketplace add zenuml/diagram --sparse .claude-plugin plugins` so Claude Code only fetches the marketplace manifest and shared plugin payload.

## Planned Work
- Reduce packaged runtime size beyond the current prune-based approach.
- Measure and reduce cold-start latency for Mermaid CLI and Chromium/Puppeteer.
- Keep a real Codex install-and-prompt smoke test in the release checklist.
- Improve plugin packaging ergonomics so runtime refresh and reinstall steps are less brittle.

## Validation Expectations For Handoff
- Run `pnpm build` after code changes.
- Run `pnpm check` for TypeScript verification.
- If MCP or packaging behavior changes, rerun `pnpm package`.
- If latency-sensitive code changes, rerun `pnpm measure:latency` and record the new baseline.
- For Codex and Claude Code release readiness, verify that `plugins/runtime/` exists in the tree that will be published.
- Prefer smoke-testing both packaged draw CLIs when touching rendering flow.
- For rendering changes, verify at least:
  - one `sequenceDiagram`
  - one `stateDiagram-v2`
  - one `format: "png"` render
- For Diagramly.ai preview changes, verify preview creation through a mocked or real device-auth API.
- For Diagramly.ai cloud-preview changes, run `pnpm smoke:cloud-preview`.
- For plugin-install changes, document the exact Codex workflow that succeeds so the next handoff does not depend on tribal knowledge.
- When editing docs that describe packaging or tool contracts, keep `README.md` and `AGENTS.md` aligned in the same change.
