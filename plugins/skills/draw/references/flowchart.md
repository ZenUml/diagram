# Flowcharts in Mermaid

The renderer handles routing and spacing; you choose shapes, direction, and which path is the happy path.

## Direction

Primary flow is **top-to-bottom** (`flowchart TD`). Branches off decisions go left/right, and Mermaid routes them automatically. Use `flowchart LR` only for short, naturally horizontal flows.

## Shape vocabulary

| Meaning | Mermaid |
|---|---|
| Start / End | `([Start])` stadium |
| Process / action | `[Do the thing]` |
| Decision | `{Condition?}` |
| Input / output | `[/User input/]` parallelogram |
| Data store | `[(Database)]` cylinder |
| Subroutine | `[[Subprocess]]` |

## Decisions

Label the exit edges, not the diamond:

```mermaid
flowchart TD
  Pay{Payment OK?}
  Pay -->|Yes| Place([Order placed])
  Pay -->|No| Fail([Payment failed])
```

## Happy path and errors

- Tag the main path with the `highlight` class (see the `draw` skill "Semantic styling").
- Route error and exception edges with dashed arrows `-.->`, and tag failure nodes with `alert`.

```mermaid
flowchart TD
  classDef highlight fill:#1e3a8a,stroke:#60a5fa,stroke-width:1.5px,color:#e2e8f0;
  classDef alert fill:#881337,stroke:#fb7185,stroke-width:1.5px,color:#e2e8f0;
  Start([Cart review]):::highlight --> Pay{Pay?}
  Pay -->|Yes| Done([Order placed]):::highlight
  Pay -.->|No| Failed([Payment failed]):::alert
```

## Merges and loop-backs

Point an edge back to the target node and Mermaid routes the merge or loop. Do not try to hand-place connectors or route them around boxes.

## Keep it shallow

- Avoid deeply nested branching when a flatter path works.
- Prefer short node labels; keep prose out of nodes.
- For 10+ steps, group phases with `subgraph` blocks to act as swimlanes:

```mermaid
flowchart TD
  subgraph Intake
    A([Receive]) --> B[Validate]
  end
  subgraph Fulfillment
    C[Pick] --> D[Pack] --> E([Ship])
  end
  B --> C
```
