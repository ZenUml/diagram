# Architecture Diagrams in Mermaid

Translate the layering and grouping instincts of a good architecture diagram into Mermaid idioms. The renderer owns pixel layout, spacing, and routing; your job is the semantic structure.

## Engine choice

- **`flowchart` (LR/TD) with `subgraph`** is the workhorse. It gives you layers, nested regions, labeled edges, and the full `classDef` palette. Prefer it for almost all architecture diagrams.
- **`architecture-beta`** is an option for simple service-and-group maps (services, groups, junctions, edges). It has limited layout control, so reach for it only when the diagram is a flat set of grouped services.

## Flow direction

Pick one primary direction and keep edges flowing that way:

- **`flowchart LR`** — data pipelines and request flows. Clients on the left, data stores on the right.
- **`flowchart TD`** — layered stacks. Clients at the top, infrastructure at the bottom.

Place databases and storage at the end of the flow (right in LR, bottom in TD).

## Layering algorithm

1. Group components by role: clients, edge/gateway, services, data, infrastructure.
2. Give each layer (or each shared-infrastructure region) its own `subgraph`.
3. Connect layers with edges that follow the primary direction.
4. Apply the semantic palette (see the `draw` skill "Semantic styling"): `frontend`, `backend`, `db`, `infra`, `connector`, `external`.

## Region boundaries

A `subgraph` is a region boundary. Style it to match the palette, and nest subgraphs for multi-region or multi-cloud (outer = provider, middle = region/VPC, inner = AZ/subnet):

```mermaid
flowchart TD
  classDef backend fill:#064e3b,stroke:#34d399,stroke-width:1.5px,color:#e2e8f0;
  classDef db fill:#4c1d95,stroke:#a78bfa,stroke-width:1.5px,color:#e2e8f0;
  subgraph Region[AWS us-east-1]
    API[API Service]:::backend
    DB[(PostgreSQL)]:::db
    API --> DB
  end
  style Region fill:#0b1220,stroke:#fbbf24,color:#e2e8f0
```

## Message / event bus

Mermaid has no "bus bar". Model a shared bus as a single connector node that producers and consumers attach to:

```mermaid
flowchart TD
  classDef backend fill:#064e3b,stroke:#34d399,stroke-width:1.5px,color:#e2e8f0;
  classDef connector fill:#7c2d12,stroke:#fb923c,stroke-width:1.5px,color:#e2e8f0;
  classDef db fill:#4c1d95,stroke:#a78bfa,stroke-width:1.5px,color:#e2e8f0;
  SvcA[Orders]:::backend --> Bus{{Event Bus}}:::connector
  SvcB[Billing]:::backend --> Bus
  Bus --> Sink[(Warehouse)]:::db
```

## Edges

- Keep edges meaningful. Label only when the label adds information (`-->|writes|`, `-->|gRPC|`).
- Keep the direction consistent; avoid back-edges unless they model real feedback.
- For secondary or async links, use dashed edges `-.->`.

## Worked example (layered, TD)

```mermaid
flowchart TD
  classDef frontend fill:#083344,stroke:#22d3ee,stroke-width:1.5px,color:#e2e8f0;
  classDef backend fill:#064e3b,stroke:#34d399,stroke-width:1.5px,color:#e2e8f0;
  classDef db fill:#4c1d95,stroke:#a78bfa,stroke-width:1.5px,color:#e2e8f0;
  classDef infra fill:#78350f,stroke:#fbbf24,stroke-width:1.5px,color:#e2e8f0;

  subgraph Clients
    Web[Web App]:::frontend
    Mobile[Mobile App]:::frontend
  end
  subgraph Edge[Edge]
    LB[Load Balancer]:::infra
  end
  subgraph Services
    Auth[Auth]:::backend
    Orders[Orders]:::backend
  end
  subgraph Data
    Cache[(Redis)]:::db
    DB[(PostgreSQL)]:::db
  end

  Web --> LB
  Mobile --> LB
  LB --> Auth
  LB --> Orders
  Orders --> Cache
  Orders --> DB
```
