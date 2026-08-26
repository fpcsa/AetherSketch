# AetherSketch architecture

## Scope

This document describes the Prompt 2 foundation and Architecture IR. It deliberately does not describe the later analysis engines, simulation engine, visual XYFlow editor, or WebMCP tools as implemented features.

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
- `src/architecture/catalog` defines AWS-first mappings and safe defaults for the 19 MVP component kinds.
- `src/architecture/serialization` is the schema-validated JSON boundary.
- `src/stores/architecture-store.ts` owns the current Architecture IR and all domain mutations.
- `src/stores/workspace-ui-store.ts` separately owns transient presentation state, such as the active palette category.
- `src/templates` owns three validated starting architectures.
- `src/utils` contains framework-independent helpers and validation schemas.
- `worker` is isolated from React and currently exposes only service health.

## Domain boundary

The Architecture IR is the source of truth for components, semantic connections, constraints, provider context, versioning, and metadata. It has no React or XYFlow dependencies.

Components form a discriminated TypeScript union keyed by `kind`. Each kind has a bounded configuration schema, catalog defaults, an AWS service mapping, a baseline monthly estimate, a default visual size, and a declared set of supported properties. The model remains provider-neutral because provider and service are data on each component rather than assumptions in the IR shape.

Connections are semantic records with source and target component IDs, a connection type, optional protocol, encryption state, criticality, and metadata. Architecture validation rejects dangling endpoints, duplicate component/connection IDs, and self-connections.

The Zod schema version is currently `1`. Deserialization validates the complete graph before returning an Architecture, and failures use `INVALID_ARCHITECTURE` with structured issue details.

The later XYFlow canvas will be a rendering and interaction projection. XYFlow node and edge objects will not be stored as the architecture domain model. UI selection, viewport state, and future simulation overlays will remain outside architectural undo history.

## Store and history

The Zustand architecture store exposes domain-oriented actions instead of encouraging UI components to patch state. Mutations validate a complete candidate IR before commit, increment its revision, capture the prior Architecture snapshot, clear the redo branch, and append an actor-aware activity record.

Locked components reject configuration changes and removal through `COMPONENT_LOCKED`. Position changes use a dedicated action and remain allowed. Removing an unlocked component also removes its connected semantic edges so the IR cannot become dangling.

Undo and redo operate only on Architecture snapshots. Activity records remain an append-only audit view, while transient UI state lives in a separate store.

## Persistence

The store persists the current architecture, activity, and bounded undo/redo snapshots under the versioned key `aethersketch.architecture.v1`. Persistence uses browser localStorage when available and an in-memory fallback when storage access is unavailable. Rehydrated data is schema validated; invalid persisted state falls back safely to the Ecommerce template.

No remote database or Cloudflare D1 binding is used.

## Templates

- **Ecommerce Production** is the default and intentionally keeps its critical ECS service and PostgreSQL database in one availability zone.
- **Serverless API** models API Gateway, Lambda, DynamoDB, and monitoring.
- **Event Processing** models EventBridge, SQS, Lambda, object storage, and monitoring.

Template getters return cloned, validated architectures so mutations cannot alter the canonical definitions.

## WebMCP boundary

No WebMCP API is registered in this milestone. The visible status text says that integration is pending/not registered. A later `src/webmcp` layer will be added only after the current official API has been verified, and it will call the same domain operations as the human UI.

## Dependency rationale

- React and Vite provide the client application shell.
- The Cloudflare Vite plugin and Wrangler provide a production-faithful Worker runtime and combined asset deployment.
- Tailwind CSS provides the visual system and compact layout utilities.
- Zustand owns the Architecture IR through a dedicated domain-action store and separately owns transient UI state.
- Zod validates structured runtime boundaries, starting with the health response contract.
- `@xyflow/react` is pinned as part of the intended stack but remains unused until the editor milestone.
- lucide-react provides accessible, consistent interface iconography.
- Vitest and Testing Library verify both rendered application structure and Worker behavior.
