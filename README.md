# diagram

`diagram` is a visual modeling plugin for Codex and Claude Code.

Use it when a diagram would make an explanation easier to understand, even if your request is not phrased as a drawing task. It can model architecture, code dependencies, API call chains, workflows, state transitions, data models, and existing Mermaid source.

## What It Does

- Turns architecture, dependency, workflow, state, data-model, and call-chain discussions into diagrams.
- Renders diagrams to local `htmlPath`, `svgPath`, and `pngPath` outputs by default.
- Validates Mermaid before rendering and reports useful diagnostics when something is wrong.
- Defaults to `zenuml` for new sequence-diagram requests unless you explicitly ask for Mermaid native `sequenceDiagram`.
- Can create a Diagramly.ai online diagram for long-term storage and sharing after local rendering succeeds.

## Install

### Codex CLI

This plugin currently targets Codex CLI. Enable plugins in your Codex config:

```toml
[features]
plugins = true
```

Add the marketplace:

```bash
codex plugin marketplace add zenuml/diagram
codex
```

Then run `/plugins` inside Codex CLI and install `diagram` from the list.

### Claude Code

Add the marketplace and install the plugin:

```bash
claude plugin marketplace add zenuml/diagram --sparse .claude-plugin plugins
claude plugin install diagram@diagram
```

## Prompts To Try

### Architecture From Context

```text
Draw a diagram for the architecture design we discussed earlier.
```

### Flowchart

```text
Create a flowchart for checkout:
cart review -> payment -> fraud check -> order placed
add a failure branch from payment to payment failed
```

### Sequence Diagram

```text
Draw a sequence diagram for oauth login flow.
```

This defaults to `zenuml` unless you explicitly request Mermaid native `sequenceDiagram`.


### State Diagram

```text
Draw a stateDiagram for order status with cancel support.
```

### Class Diagram

```text
Draw a class diagram for Order, Customer, Payment, and Shipment.
```

### Render Existing Mermaid

```text
Validate this Mermaid, fix it if needed, render it, and return the html path, svg path, and png path:

stateDiagram-v2
  [*] --> Created
  Created --> Paid
  Paid --> Shipped
  Shipped --> Delivered
```

### Code Analysis

```text
Explain the complete call chain for this @codepath.
```

## Supported Diagram Types

You can ask for any diagram type supported by the plugin, including:

- `architecture`
- `block` / `block-beta`
- `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`
- `classDiagram` / `classDiagram-v2`
- `erDiagram`
- `flowchart`, `flowchart-elk`, and `graph`
- `gantt`
- `gitGraph`
- `ishikawa` / `ishikawa-beta`
- `journey`
- `kanban`
- `mindmap`
- `packet` / `packet-beta`
- `pie`
- `quadrantChart`
- `radar-beta`
- `requirement` / `requirementDiagram`
- `sankey` / `sankey-beta`
- `sequenceDiagram`
- `stateDiagram` / `stateDiagram-v2`
- `timeline`
- `treeView-beta`
- `treemap` / `treemap-beta`
- `venn`
- `wardley-beta`
- `xychart` / `xychart-beta`
- `zenuml`

## Output

When local rendering succeeds, the final response includes a stable text summary like:

```text
+----------------------------------------------------------------------------------------------------------------------+
| diagram draw                                                                                                         |
+----------------------------------------------------------------------------------------------------------------------+
| Status:        OK                                                                                                    |
| Diagram Type:  flowchart                                                                                             |
|                                                                                                                      |
| Resources                                                                                                            |
| HTML Path:     /tmp/dv/payment-flow/index.html                                                                       |
| SVG Path:      /tmp/dv/payment-flow/diagram.svg                                                                      |
| PNG Path:      /tmp/dv/payment-flow/diagram.png                                                                      |
+----------------------------------------------------------------------------------------------------------------------+
```

Open the returned `htmlPath` directly to view the rendered diagram. The `svgPath` and `pngPath` files are suitable for copying into docs, tickets, or presentations.

## Diagramly.ai Online Diagrams

Local rendering works without signing in to Diagramly.ai.

If you want an online diagram for long-term storage and sharing, the assistant can create one after local rendering succeeds. When authorization is needed, it will first return your local files, then ask whether you want to continue with Diagramly.ai sign-in.

After authorization succeeds, the final response includes a Diagramly.ai `PreviewUrl`.
