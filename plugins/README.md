# diagram plugin

This directory is the shared installable plugin root used by the Codex and Claude Code marketplace flows.

Codex reads `.codex.mcp.json` through `.codex-plugin/plugin.json`; Claude Code reads `.mcp.json` through `.claude-plugin/plugin.json`.

## Local test flow

1. Build the runtime:

   ```bash
   git clone https://github.com/zenuml/diagram.git
   cd diagram
   pnpm install
   pnpm package
   ```

2. For Codex, make sure plugin support is enabled in your Codex config:

   ```toml
   [features]
   plugins = true
   ```

3. Start or restart Codex in this repo:

   ```bash
   codex -C .
   ```

4. Run `/plugins` inside Codex CLI, then install `diagram` from the list.

5. If the install does not refresh immediately, start a fresh Codex session:

   ```bash
   codex -C .
   ```

6. If Codex still starts an older installed copy, clear the local plugin cache and reinstall:

   ```bash
   pnpm reset:codex-plugin-cache
   codex -C .
   ```

For Claude Code, add the repository marketplace with `claude plugin marketplace add ./`, then install `diagram@diagram`.

The plugin should then contribute the Diagramly.ai MCP tools, the packaged local draw CLI, and the `draw` skill.
