# AetherSketch foundation architecture

## Scope

This document describes the Prompt 1 foundation. It deliberately does not describe the later Architecture IR, analysis engines, simulation engine, or WebMCP tools as implemented features.

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
- `src/stores` currently owns only transient presentation state, such as the active palette category.
- `src/utils` contains framework-independent helpers and validation schemas.
- `worker` is isolated from React and currently exposes only service health.

## Planned domain boundary

The provider-neutral Architecture IR will be created in a later milestone under `src/architecture`. It will be the source of truth for components, connections, constraints, and metadata.

The later XYFlow canvas will be a rendering and interaction projection. XYFlow node and edge objects will not be stored as the architecture domain model. UI selection, viewport state, and future simulation overlays will remain outside architectural undo history.

## WebMCP boundary

No WebMCP API is registered in this milestone. The visible status text says that integration is pending/not registered. A later `src/webmcp` layer will be added only after the current official API has been verified, and it will call the same domain operations as the human UI.

## Dependency rationale

- React and Vite provide the client application shell.
- The Cloudflare Vite plugin and Wrangler provide a production-faithful Worker runtime and combined asset deployment.
- Tailwind CSS provides the visual system and compact layout utilities.
- Zustand currently stores UI-only state and will later host domain actions in a separate store.
- Zod validates structured runtime boundaries, starting with the health response contract.
- `@xyflow/react` is pinned as part of the intended stack but remains unused until the editor milestone.
- lucide-react provides accessible, consistent interface iconography.
- Vitest and Testing Library verify both rendered application structure and Worker behavior.
