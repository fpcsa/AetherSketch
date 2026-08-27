# AetherSketch — Architecture Copilot

> The architecture canvas built for humans and agents.

AetherSketch is a visual cloud-architecture workspace designed for a human and an AI agent to inspect and eventually modify the same deterministic architecture state. Humans provide intent, constraints, and judgment; agents provide reasoning and execution; AetherSketch provides the shared canvas, deterministic state, and structured tools.

ChatGPT is the copilot. AetherSketch does **not** embed a chatbot, call an LLM API, or perform backend AI inference.

## Current status

This repository currently implements the Prompt 4 visual-workspace milestone:

- a compact, desktop-first architecture workspace built on XYFlow;
- a strongly typed, provider-neutral Architecture IR with an explicit schema version;
- an AWS-first catalog for 19 MVP component kinds;
- semantic connections, human constraints, component locks, and typed domain errors;
- an actor-aware Zustand store with domain actions, undo/redo, activity history, and localStorage persistence;
- Ecommerce Production, Serverless API, and Event Processing templates;
- deterministic validation, cost, resilience, security, constraint, and failure-simulation engines;
- structured findings with stable IDs, evidence, severity, and remediation guidance;
- a transient intelligence store that marks analysis stale and clears simulations when architecture state changes;
- custom typed nodes and semantic edges projected from the Architecture IR;
- click/drag catalog creation, movement, connections, selection, deletion, zoom, pan, and fit-view controls;
- typed component and connection inspectors with enforced component locks;
- editable constraints with deterministic status, interactive findings, and canvas focus;
- component, availability-zone, and region simulation controls with failed/degraded canvas states;
- templates, a blank workspace, validated JSON import/export, demo reset, and activity history;
- a persisted dark/light workspace theme with theme-aware canvas controls, nodes, edges, and panels;
- live estimated cost, resilience, and security indicators throughout the shell;
- real WebMCP feature detection without tool registration or fake connectivity;
- Cloudflare Workers + static-assets integration with `GET /api/health`;
- strict TypeScript, ESLint, Prettier, Vitest, and domain/store/component/Worker tests.

Actual WebMCP tool registration is intentionally deferred to the next milestone. The regular human workspace remains fully usable when WebMCP is unavailable.

## Architecture

The project separates application composition, presentational components, UI-only state, and Worker code:

```text
src/
  architecture/
    analysis/           Deterministic validation, cost, scoring, constraints
    catalog/            AWS-first component catalog and creation defaults
    model/              Provider-neutral IR, Zod schemas, errors, factories
    serialization/      Validated JSON import/export boundary
    simulation/         Deterministic component, AZ, and region failures
  app/                  Application composition
  components/
    agent/              Truthful WebMCP feature detection
    analysis/           Interactive score and findings panel
    canvas/             XYFlow projection, custom nodes, semantic edges
    inspector/          Typed properties and editable constraints
    layout/             Top/status bars, notices, activity drawer
    palette/            Catalog navigation, click/drag component creation
    simulation/         Failure controls and transient impact summary
  stores/               Architecture, UI, and transient derived-result state
  templates/            Validated architecture starting points
  styles/               Tailwind entry point and workspace styling
  utils/                Shared runtime schemas
worker/                 Cloudflare Worker entry point
tests/                  Component and Worker tests
docs/                   Architecture decisions and boundaries
```

The provider-neutral Architecture IR lives outside React and XYFlow. The architecture store owns that IR and exposes domain actions; React subscribes to it without mutating raw state. XYFlow keeps transient drag and viewport state, then commits architectural changes through store actions. Analysis and simulation are pure projections of an Architecture snapshot and live in a separate, non-persisted intelligence store. Selection, panel, notice, and palette state remain in a separate UI store; the visual theme is persisted independently and never enters architectural history.

### Deterministic intelligence

`analyzeArchitecture` runs structural validation, a simplified cost model, resilience scoring, security scoring, and explicit constraint evaluation against the same immutable Architecture input. Every finding is machine-readable and deterministic; there are no model calls, network calls, or hidden cloud credentials.

The default Ecommerce Production template currently produces:

- **Estimated architecture cost:** $675/month;
- **Resilience:** 57/100;
- **Security:** 76/100;
- **Validation:** valid, with resilience findings for its single-AZ ECS/RDS critical path and security findings for the missing WAF and secrets manager.

These values are transparent design feedback, not an AWS quote, SLA, penetration test, or prediction. See [docs/ANALYSIS.md](docs/ANALYSIS.md) for exact rules, assumptions, and limitations.

### Architecture IR

An architecture includes its identity, description, provider context, region, schema version, revision, typed components, semantic connections, human constraints, and metadata. Components are a discriminated union keyed by `kind`, so an RDS-style SQL database cannot accidentally receive queue configuration, for example.

Connections describe architectural meaning (`request`, `async`, `data`, `replication`, `trigger`, or `management`) rather than only visual lines. Zod validation rejects duplicate IDs, dangling endpoints, self-connections, malformed component configuration, and unsupported schema versions.

### Store API

`useArchitectureStore` exposes these domain actions:

- project lifecycle: `createArchitecture`, `loadArchitecture`, `renameArchitecture`, `resetArchitecture`;
- components: `addComponent`, `updateComponent`, `removeComponent`, `moveComponent`, `lockComponent`, `unlockComponent`;
- connections and constraints: `connectComponents`, `updateConnection`, `disconnectComponents`, `setConstraints`;
- history: `undo`, `redo`.

Every mutation accepts `human`, `agent`, or `system` actor attribution and records a structured activity entry. Locked components may still be inspected or moved, but cannot be configured or removed until explicitly unlocked. Architecture snapshots—not transient UI state—power undo and redo.

### Default Ecommerce IR

```text
Customer Traffic
  → Storefront CDN (CloudFront)
  → Public Application Load Balancer
  → Storefront API (ECS, one replica in eu-west-1a)
  → Orders Database (RDS PostgreSQL, single-AZ)
```

The single-AZ compute and database tiers are intentional weaknesses that make the analysis and failure-simulation panels immediately useful.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current boundaries and planned extension points.

## Technology stack

- React and TypeScript
- Vite with the Cloudflare Vite plugin
- Cloudflare Workers and static assets
- Tailwind CSS
- Zustand
- Zod
- `@xyflow/react` for the interactive projection (never used as domain state)
- lucide-react
- Vitest and Testing Library

## Local development

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer

Install dependencies and start the Cloudflare-backed Vite development environment:

```bash
npm install
npm run dev
```

Vite serves both the React application and Worker routes. Verify the Worker at:

```text
GET http://localhost:5173/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "aethersketch"
}
```

## Quality commands

```bash
npm run build
npm run typecheck
npm run lint
npm run test
npm run format:check
```

`npm run preview` builds and serves the production output in the Workers runtime. `npm run deploy` builds and deploys the Worker and static assets together with Wrangler; Cloudflare account authorization is required only for deployment.

## Cloudflare configuration

[`wrangler.jsonc`](wrangler.jsonc) points at [`worker/index.ts`](worker/index.ts), enables SPA asset fallback, and routes `/api/*` through the Worker. The Cloudflare Vite plugin uses the same configuration during development, build, preview, and deployment. No secrets, database, authentication, or environment variables are required.

## Product boundaries

AetherSketch currently has:

- no OpenAI or Anthropic API dependency;
- no embedded assistant or chat surface;
- no authentication or database;
- no cloud credentials or infrastructure deployment capability;
- no fake `document.modelContext` or mock WebMCP registration;
- no LLM, probabilistic inference, or opaque scoring inside the architecture engines.

## License

AetherSketch is licensed under the existing [GNU Affero General Public License v3.0 or later](LICENSE).
