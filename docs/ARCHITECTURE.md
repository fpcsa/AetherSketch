# AetherSketch architecture

## Scope

This document describes the provider-neutral Architecture IR, deterministic intelligence layer, submission-quality visual workspace, WebMCP authority boundary, and Prompt 7 agent-session comparison.

## Runtime shape

The application is one Cloudflare deployment unit:

```text
Browser navigation ──> Cloudflare static assets ──> React workspace shell
Browser /api/* call ─> Cloudflare Worker ─────────> deterministic API response
Browser agent ───────> document.modelContext ─────> WebMCP authority adapter
                                                    └─> shared stores/domain actions
```

The Cloudflare Vite plugin runs the React client and Worker together in development and produces their deployable output together at build time. SPA fallback is configured through Wrangler while `/api/*` is explicitly routed to the Worker.

## Frontend boundaries

- `src/app` composes the root workspace route.
- `src/components` owns small, presentation-focused workspace regions.
- `src/architecture/model` defines the provider-neutral Architecture IR, strict runtime schemas, factories, and typed errors.
- `src/architecture/catalog` defines safe defaults and optional AWS mappings for 21 typed component kinds, including provider-neutral serverless AI/LLM and agent concepts.
- `src/architecture/comparison` computes before/after metrics and structural changes directly from two Architecture IR snapshots.
- `src/architecture/analysis` contains pure validation, cost, score, constraint, and combined-analysis functions.
- `src/architecture/simulation` contains pure component, availability-zone, and region failure simulation.
- `src/architecture/serialization` is the schema-validated JSON boundary.
- `src/stores/architecture-store.ts` owns the current Architecture IR and all domain mutations.
- `src/stores/intelligence-store.ts` owns non-persisted analysis and simulation results.
- `src/stores/workspace-ui-store.ts` separately owns selection, focus requests, open panels, notices, and other transient presentation state.
- `src/stores/theme-store.ts` owns the independently persisted dark/light visual preference and applies it to the browser shell.
- `src/templates` owns three validated starting architectures.
- `src/utils` contains framework-independent helpers and validation schemas.
- `src/webmcp` isolates feature detection, strict schemas, compact output shaping, domain-error translation, tool execution, imperative registration, lifecycle state, and cleanup.
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

Constraints remain human-authored IR data. Their UI presents stale state after edits and explicit deterministic results after analysis. Findings can select and focus affected nodes or edges. Failure simulation remains a transient overlay and never writes to project persistence or history. Failed and degraded nodes receive both icon/text overlays and semantic state, impacted edges are labeled as failed paths or reduced capacity, and a canvas-level headline makes operational status readable in a recorded demo.

The top bar owns template/reset, validated JSON import/export, undo/redo, activity history, copyable demo prompts, and the persisted dark/light theme toggle. **Reset Demo** restores the canonical Ecommerce template and clears history, activity, simulation, Agent Edit authorization, selection, and the temporary comparison checkpoint. Invalid imports are rejected before `loadArchitecture`, preserving the current project. A canvas-local error boundary also keeps the surrounding workspace and saved Architecture IR available if a third-party graph renderer fails.

## Agent-session comparison

Enabling Agent Edit Mode clones the current Architecture IR into an in-memory baseline. The baseline includes the human's locks and constraints, so the comparison begins at the exact authority handoff rather than at a template constant. It is never an XYFlow snapshot.

`compareArchitectures(baseline, current)` independently analyzes both immutable snapshots, reports before/after/delta values for estimated cost, resilience, and security, then matches components and connections by stable IR ID. It reports added and removed entities plus field-level changes for architecture fields, component configuration, positions, and semantic connection properties. Results are sorted deterministically. The comparison UI subscribes to live architecture state only while open, avoiding hidden analysis work during ordinary editing.

Disabling Agent Edit Mode retains the baseline and opens the completed comparison. Loading/importing another project or using Reset Demo clears the baseline so comparisons cannot cross project boundaries.

## Intelligence boundary

All analysis functions accept an Architecture value and return structured results without mutating their input. The combined `analyzeArchitecture` operation always calculates validation, estimated cost, resilience, security, and constraint results; its optional focus only filters the top-level finding list.

Findings have stable IDs, explicit rule codes, severity, category, human-readable explanation and remediation, component or edge references where relevant, and JSON evidence. Scores expose every numeric adjustment. Constraint evaluation compares calculated values against the Architecture's human-authored budget, target scores, required region, Multi-AZ requirement, and encryption-at-rest requirement.

The intelligence store is deliberately separate from the persisted architecture store. Running or clearing analysis and simulation never changes the IR or undo/redo history. The WebMCP adapter may append a non-mutating activity entry describing an agent-triggered analysis or simulation; that record is not part of the intelligence result and creates no architecture revision. When the architecture reference changes, an existing analysis is marked stale and any prior simulation is cleared. Re-running analysis binds results to the new architecture revision.

See [`ANALYSIS.md`](ANALYSIS.md) for the rule model and limitations.

## Store and history

The Zustand architecture store exposes domain-oriented actions instead of encouraging UI components to patch state. Mutations validate a complete candidate IR before commit, increment its revision, capture the prior Architecture snapshot, clear the redo branch, and append an actor-aware activity record.

Locked components reject configuration changes and removal through `COMPONENT_LOCKED`. Lock and unlock actions are intentionally human-only at the WebMCP boundary. Position changes use a dedicated human action and remain allowed. Removing an unlocked component also removes its connected semantic edges so the IR cannot become dangling.

Undo and redo operate only on Architecture snapshots. Activity records remain an append-only audit view during ordinary work, while transient UI and intelligence state live in separate stores. Canonical Reset Demo intentionally clears the audit view and both history branches for repeatable judging sessions.

## Persistence

The store persists the current architecture, activity, and bounded undo/redo snapshots under the versioned key `aethersketch.architecture.v1`. Persistence uses browser localStorage when available and an in-memory fallback when storage access is unavailable. Rehydrated data is schema validated; invalid persisted state falls back safely to the Ecommerce template and produces a visible recovery notice. Agent-session comparison and simulations are intentionally not persisted.

No remote database or Cloudflare D1 binding is used.

## Templates

- **Ecommerce Production** is the default and intentionally keeps its critical ECS service and PostgreSQL database in one availability zone.
- **Serverless API** models API Gateway, Lambda, DynamoDB, and monitoring.
- **Event Processing** models EventBridge, SQS, Lambda, object storage, and monitoring.

Template getters return cloned, validated architectures so mutations cannot alter the canonical definitions.

## WebMCP boundary

The integration uses the verified imperative `document.modelContext.registerTool` API and official `webmcp-types` declarations. Review Mode is the default and registers exactly four read tools: `get_architecture`, `inspect_component`, `analyze_architecture`, and `simulate_failure`. A human can explicitly enable Agent Edit Mode, which registers exactly five additional tools: `add_component`, `update_component`, `remove_component`, `connect_components`, and `disconnect_components`.

Tool descriptors, JSON-compatible input schemas, runtime Zod validation, compact result projection, and structured error conversion live outside React. The runtime injects store-backed dependencies into those pure descriptors. `get_architecture` and `inspect_component` read current Architecture IR directly; `analyze_architecture` and `simulate_failure` call the intelligence store's existing domain actions and switch the existing right-side panel through the UI store. No analysis or simulation business logic is duplicated.

The mutation descriptors accept only safe domain fields. Kind-specific configuration is validated against the IR's discriminated Zod schema, catalog defaults fill omitted values, and automatic positioning keeps XY coordinates out of the agent contract. Each mutation calls an existing store action with `actor="agent"`; there is no parallel mutation path and no arbitrary patch tool. The agent is not given lock/unlock, constraint, import/reset, history, metadata, provider/service, cost, or raw-position controls.

Feature detection requires a callable `document.modelContext.registerTool`. Supported pages progress from Initializing to Ready only after all read registration promises resolve. One long-lived `AbortController` owns the read group. Each enable cycle creates a second controller for the mutation group; disabling first revokes permission and then aborts that signal, so read registrations survive and edit registrations cannot leak or duplicate. Unsupported browsers continue as complete human workspaces. Status never equates API readiness with agent connectivity.

Mutation execution checks Edit Mode both before schema parsing and immediately before the synchronous store action. That second check closes the cached-reference and in-flight-disable race. Hard IR invariants and locks fail closed, while human budget/resilience/security/region/Multi-AZ/encryption constraints remain visible soft goals evaluated after multi-step changes.

The read tools are annotated read-only; mutation tools explicitly are not. Analysis and simulation update only transient intelligence/presentation state and never mutate Architecture IR or history. See [`WEBMCP.md`](WEBMCP.md) for schemas, outputs, lifecycle, structured errors, testing, and current draft/type-package differences, and [`SECURITY.md`](SECURITY.md) for the authority model.

## Dependency rationale

- React and Vite provide the client application shell.
- The Cloudflare Vite plugin and Wrangler provide a production-faithful Worker runtime and combined asset deployment.
- Tailwind CSS provides the visual system and compact layout utilities.
- Zustand owns the Architecture IR through a dedicated domain-action store and separately owns transient UI and intelligence state.
- Zod validates structured runtime boundaries, starting with the health response contract.
- `@xyflow/react` renders the interactive graph while the provider-neutral IR remains authoritative.
- lucide-react provides accessible, consistent interface iconography.
- Vitest and Testing Library verify both rendered application structure and Worker behavior.
- `webmcp-types` supplies the verified global TypeScript surface for `document.modelContext` without a runtime compatibility layer.
