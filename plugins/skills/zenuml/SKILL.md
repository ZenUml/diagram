---
name: zenuml
description: Use when the task needs Mermaid `zenuml` syntax, especially for new sequence diagrams, interaction flows, API call chains, or when the user explicitly asks for ZenUML. Focuses on drafting valid ZenUML syntax and using the packaged diagram draw CLI to validate and render it.
---

# ZenUML

Use this skill alongside `draw` when the selected diagram type is `zenuml`.

## Workflow

1. If the user already provided `zenuml` source, preserve its structure unless it is clearly invalid.
2. Otherwise, read [references/language-guide.md](references/language-guide.md) before drafting new `zenuml`.
3. Draft the interaction in ZenUML syntax rather than Mermaid native `sequenceDiagram` syntax.
4. Run the packaged diagram draw CLI described in the `draw` skill.
5. If validation fails, repair the ZenUML once and run the draw CLI again.
6. Use the local files returned by the draw CLI, then follow the local reporting and optional Diagramly.ai upload flow described in the `draw` skill.

## Drafting rules

- Treat the official ZenUML docs linked in the reference file as the syntax ground truth.
- Use `sequenceDiagram` instead when the user explicitly asks for Mermaid native sequence syntax.
- Keep participants and message labels short.
- Prefer sync-style nesting when later steps depend on return values.
- Use async arrows for one-way notifications or events.
- Keep conditions code-like, not natural-language phrases.
