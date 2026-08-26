# AetherSketch — Architecture Copilot

> The architecture canvas built for humans and agents.

AetherSketch is a visual cloud-architecture workspace designed for a human and an AI agent to inspect and eventually modify the same deterministic architecture state. Humans provide intent, constraints, and judgment; agents provide reasoning and execution; AetherSketch provides the shared canvas, deterministic state, and structured tools.

ChatGPT is the copilot. AetherSketch does **not** embed a chatbot, call an LLM API, or perform backend AI inference.

## Current status

This repository currently implements the Prompt 1 foundation:

- a compact, desktop-first architecture workspace shell;
- top bar, component palette, canvas placeholder, inspector, constraints panel, and status bar;
- truthful placeholders for undo, redo, import, export, analysis metrics, and WebMCP;
- Cloudflare Workers + static-assets integration with `GET /api/health`;
- strict TypeScript, ESLint, Prettier, Vitest, and component/Worker tests.

The architecture editor, Architecture IR, deterministic analysis engines, and actual WebMCP tools are intentionally deferred to later milestones. No placeholder pretends those capabilities already exist.

## Architecture

The project separates application composition, presentational components, UI-only state, and Worker code:

```text
src/
  app/                  Application composition
  components/
    agent/              Honest WebMCP status presentation
    canvas/             Canvas shell (XYFlow projection comes later)
    inspector/          Inspector and constraints shell
    layout/             Top and status bars
    palette/            Palette navigation and display metadata
  stores/               UI-only Zustand state
  styles/               Tailwind entry point and workspace styling
  utils/                Shared runtime schemas
worker/                 Cloudflare Worker entry point
tests/                  Component and Worker tests
docs/                   Architecture decisions and boundaries
```

Future provider-neutral architecture state will live outside React and XYFlow. XYFlow will render a projection of that state and will never become the domain source of truth. The existing Zustand store contains only transient workspace UI state.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current boundaries and planned extension points.

## Technology stack

- React and TypeScript
- Vite with the Cloudflare Vite plugin
- Cloudflare Workers and static assets
- Tailwind CSS
- Zustand
- Zod
- `@xyflow/react` (installed for the later canvas milestone, not initialized prematurely)
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
