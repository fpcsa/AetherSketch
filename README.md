# AetherSketch — Architecture Copilot

> The architecture canvas built for humans and agents.

AetherSketch is a visual cloud-architecture workspace designed for a human and an AI agent to inspect and eventually modify the same deterministic architecture state. Humans provide intent, constraints, and judgment; agents provide reasoning and execution; AetherSketch provides the shared canvas, deterministic state, and structured tools.

ChatGPT is the copilot. AetherSketch does **not** embed a chatbot, call an LLM API, or perform backend AI inference.

## Current status

This repository currently implements the Prompt 2 architecture-state milestone:

- a compact, desktop-first architecture workspace shell;
- a strongly typed, provider-neutral Architecture IR with an explicit schema version;
- an AWS-first catalog for 19 MVP component kinds;
- semantic connections, human constraints, component locks, and typed domain errors;
- an actor-aware Zustand store with domain actions, undo/redo, activity history, and localStorage persistence;
- Ecommerce Production, Serverless API, and Event Processing templates;
- a read-only IR preview in the shell, with Ecommerce Production loaded by default;
- truthful placeholders for import, export, analysis metrics, and WebMCP;
- Cloudflare Workers + static-assets integration with `GET /api/health`;
- strict TypeScript, ESLint, Prettier, Vitest, and domain/store/component/Worker tests.

The XYFlow editor, deterministic analysis engines, simulation UI, and actual WebMCP tools are intentionally deferred to later milestones. No placeholder pretends those capabilities already exist.

## Architecture

The project separates application composition, presentational components, UI-only state, and Worker code:

```text
src/
  architecture/
    catalog/            AWS-first component catalog and creation defaults
    model/              Provider-neutral IR, Zod schemas, errors, factories
    serialization/      Validated JSON import/export boundary
  app/                  Application composition
  components/
    agent/              Honest WebMCP status presentation
    canvas/             Canvas shell (XYFlow projection comes later)
    inspector/          Inspector and constraints shell
    layout/             Top and status bars
    palette/            Palette navigation and display metadata
  stores/               Architecture source of truth and separate UI state
  templates/            Validated architecture starting points
  styles/               Tailwind entry point and workspace styling
  utils/                Shared runtime schemas
worker/                 Cloudflare Worker entry point
tests/                  Component and Worker tests
docs/                   Architecture decisions and boundaries
```

The provider-neutral Architecture IR lives outside React and XYFlow. The architecture store owns that IR and exposes domain actions; React subscribes to it without mutating raw state. Transient palette state remains in a separate UI store. XYFlow will later render a projection of the IR and will never become the domain source of truth.

### Architecture IR

An architecture includes its identity, description, provider context, region, schema version, revision, typed components, semantic connections, human constraints, and metadata. Components are a discriminated union keyed by `kind`, so an RDS-style SQL database cannot accidentally receive queue configuration, for example.

Connections describe architectural meaning (`request`, `async`, `data`, `replication`, or `management`) rather than only visual lines. Zod validation rejects duplicate IDs, dangling endpoints, self-connections, malformed component configuration, and unsupported schema versions.

### Store API

`useArchitectureStore` exposes these domain actions:

- project lifecycle: `createArchitecture`, `loadArchitecture`, `renameArchitecture`, `resetArchitecture`;
- components: `addComponent`, `updateComponent`, `removeComponent`, `moveComponent`, `lockComponent`, `unlockComponent`;
- connections and constraints: `connectComponents`, `disconnectComponents`, `setConstraints`;
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

The single-AZ compute and database tiers are intentional weaknesses for the later deterministic resilience-analysis milestone.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current boundaries and planned extension points.

## Technology stack

- React and TypeScript
- Vite with the Cloudflare Vite plugin
- Cloudflare Workers and static assets
- Tailwind CSS
- Zustand
- Zod
- `@xyflow/react` (installed for the later canvas milestone; never used as domain state)
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
- no architecture analysis engine before its dedicated milestone.

## License

AetherSketch is licensed under the existing [GNU Affero General Public License v3.0 or later](LICENSE).
