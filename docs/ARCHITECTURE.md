# AetherSketch architecture

## Scope

This document describes the Prompt 4 Architecture IR, deterministic intelligence layer, and complete human visual workspace. WebMCP tools remain a later milestone.

## Runtime shape

The application is one Cloudflare deployment unit:

```text
Browser navigation ──> Cloudflare static assets ──> React workspace shell
Browser /api/* call ─> Cloudflare Worker ─────────> deterministic API response
```

The Cloudflare Vite plugin runs the React client and Worker together in development and produces their deployable output together at build time. SPA fallback is configured through Wrangler while `/api/*` is explicitly routed to the Worker.

## Frontend boundaries

- `src/app` composes the root workspace route.
- `src/components` owns small, presentation-focused workspace regions.
- `src/architecture/model` defines the provider-neutral Architecture IR, strict runtime schemas, factories, and typed errors.
- `src/architecture/catalog` defines safe defaults and optional AWS mappings for 21 typed component kinds, including provider-neutral serverless AI/LLM and agent concepts.
- `src/architecture/analysis` contains pure validation, cost, score, constraint, and combined-analysis functions.
- `src/architecture/simulation` contains pure component, availability-zone, and region failure simulation.
- `src/architecture/serialization` is the schema-validated JSON boundary.
- `src/stores/architecture-store.ts` owns the current Architecture IR and all domain mutations.
- `src/stores/intelligence-store.ts` owns non-persisted analysis and simulation results.
- `src/stores/workspace-ui-store.ts` separately owns selection, focus requests, open panels, notices, and other transient presentation state.
- `src/stores/theme-store.ts` owns the independently persisted dark/light visual preference and applies it to the browser shell.
- `src/templates` owns three validated starting architectures.
- `src/utils` contains framework-independent helpers and validation schemas.
- `worker` is isolated from React and currently exposes only service health.

## Domain boundary

The Architecture IR is the source of truth for components, semantic connections, constraints, provider context, versioning, and metadata. It has no React or XYFlow dependencies.

Components form a discriminated TypeScript union keyed by `kind`. Each kind has a bounded configuration schema, catalog defaults, an AWS service mapping, a baseline monthly estimate, a default visual size, and a declared set of supported properties. The model remains provider-neutral because provider and service are data on each component rather than assumptions in the IR shape.

Connections are semantic records with source and target component IDs, a connection type, optional protocol, encryption state, criticality, and metadata. Architecture validation rejects dangling endpoints, duplicate component/connection IDs, and self-connections.

The Zod schema version is currently `1`. Deserialization validates the complete graph before returning an Architecture, and failures use `INVALID_ARCHITECTURE` with structured issue details.

The XYFlow canvas is a rendering and interaction projection. Node positions are initialized from the IR; transient drag state remains local to XYFlow and the final position commits through `moveComponent`. Adds, connections, deletion, and selection similarly route through domain or UI-store actions. Selection flows one way from explicit node/edge interactions into the UI store and back into the visual projection; it is not mirrored through XYFlow's aggregate selection listener. This prevents a newly connected target node and its new edge from repeatedly overwriting each other's selected state. New-edge selection is also deferred until XYFlow completes the connection gesture. XYFlow node and edge objects are never stored as the architecture domain model. UI selection, viewport state, theme, and simulation overlays remain outside architectural undo history.

## Visual workspace

Catalog entries drive the categorized component palette and typed node presentation. A transient AWS/Generic selector controls whether provider mappings appear in the palette, nodes, and inspector without changing the Architecture IR. Custom nodes show the component name, optional AWS mapping, category, lock/critical markers, modeled region or zone count, and textual operational/degraded/failed status. Semantic connection types have distinct colors and dash treatments; simulation impact overrides them with an explicit impacted state.

The AI palette category contains provider-neutral `serverless-ai` and `ai-agent` IR kinds. Their current AWS catalog mappings are Amazon Bedrock and Agents for Amazon Bedrock, while their typed configuration captures model modality, guardrails, private access, encryption, logging, orchestration, memory, and human approval independently of XYFlow.

The right workspace panel switches between typed inspection, analysis, and simulation. Component configuration fields are generated from the discriminated IR configuration, while known enum properties use bounded selectors. Locked components disable architectural fields and deletion until explicitly unlocked. Connections have a dedicated inspector for type, protocol, encryption, and criticality.

Constraints remain human-authored IR data. Their UI presents stale state after edits and explicit deterministic results after analysis. Findings can select and focus affected nodes or edges. Failure simulation remains a transient overlay and never writes to project persistence or history.

The top bar owns template/reset, validated JSON import/export, undo/redo, activity history, and the persisted dark/light theme toggle. Invalid imports are rejected before `loadArchitecture`, preserving the current project. A canvas-local error boundary also keeps the surrounding workspace and saved Architecture IR available if a third-party graph renderer fails.

## Intelligence boundary

All analysis functions accept an Architecture value and return structured results without mutating their input. The combined `analyzeArchitecture` operation always calculates validation, estimated cost, resilience, security, and constraint results; its optional focus only filters the top-level finding list.

Findings have stable IDs, explicit rule codes, severity, category, human-readable explanation and remediation, component or edge references where relevant, and JSON evidence. Scores expose every numeric adjustment. Constraint evaluation compares calculated values against the Architecture's human-authored budget, target scores, required region, Multi-AZ requirement, and encryption-at-rest requirement.

The intelligence store is deliberately separate from the persisted architecture store. Running or clearing analysis and simulation never changes the IR, activity log, or undo/redo history. When the architecture reference changes, an existing analysis is marked stale and any prior simulation is cleared. Re-running analysis binds results to the new architecture revision.

See [`ANALYSIS.md`](ANALYSIS.md) for the rule model and limitations.

## Store and history

The Zustand architecture store exposes domain-oriented actions instead of encouraging UI components to patch state. Mutations validate a complete candidate IR before commit, increment its revision, capture the prior Architecture snapshot, clear the redo branch, and append an actor-aware activity record.

Locked components reject configuration changes and removal through `COMPONENT_LOCKED`. Position changes use a dedicated action and remain allowed. Removing an unlocked component also removes its connected semantic edges so the IR cannot become dangling.

Undo and redo operate only on Architecture snapshots. Activity records remain an append-only audit view, while transient UI and intelligence state live in separate stores.

## Persistence

The store persists the current architecture, activity, and bounded undo/redo snapshots under the versioned key `aethersketch.architecture.v1`. Persistence uses browser localStorage when available and an in-memory fallback when storage access is unavailable. Rehydrated data is schema validated; invalid persisted state falls back safely to the Ecommerce template.

No remote database or Cloudflare D1 binding is used.

## Templates

- **Ecommerce Production** is the default and intentionally keeps its critical ECS service and PostgreSQL database in one availability zone.
- **Serverless API** models API Gateway, Lambda, DynamoDB, and monitoring.
- **Event Processing** models EventBridge, SQS, Lambda, object storage, and monitoring.

Template getters return cloned, validated architectures so mutations cannot alter the canonical definitions.

## WebMCP boundary

No WebMCP API is registered in this milestone. The visible status performs only real feature detection for `document.modelContext` and reports Ready or Unavailable. A later `src/webmcp` layer will be added only after the current official API has been verified, and it will call the same domain operations as the human UI.

## Dependency rationale

- React and Vite provide the client application shell.
- The Cloudflare Vite plugin and Wrangler provide a production-faithful Worker runtime and combined asset deployment.
- Tailwind CSS provides the visual system and compact layout utilities.
- Zustand owns the Architecture IR through a dedicated domain-action store and separately owns transient UI and intelligence state.
- Zod validates structured runtime boundaries, starting with the health response contract.
- `@xyflow/react` renders the interactive graph while the provider-neutral IR remains authoritative.
- lucide-react provides accessible, consistent interface iconography.
- Vitest and Testing Library verify both rendered application structure and Worker behavior.
