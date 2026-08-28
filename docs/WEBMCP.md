# WebMCP integration

## Why WebMCP is core to AetherSketch

AetherSketch is the shared architecture workspace between a human and an agent. The page owns deterministic Architecture IR, validation, cost and score analysis, failure simulation, and the visual canvas. WebMCP exposes those existing capabilities as structured browser tools so an agent can reason about the same live state the human sees.

ChatGPT is the copilot. AetherSketch does not embed a chatbot, ship an LLM client, call an AI API, or run backend inference. The browser mediates discovery and invocation while the page remains the source of tool descriptions, schemas, execution, and results.

The integration follows the current imperative API from the [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/) and [official explainer](https://github.com/webmachinelearning/webmcp):

```ts
await document.modelContext.registerTool(tool, {
  signal: registrationController.signal,
});
```

Aborting the registration signal unregisters the tool. AetherSketch does not invent `provideContext`, `unregisterTool`, or another compatibility API.

## Review Mode

Review Mode is the default. Exactly four tools are registered and all four are read-only:

### `get_architecture`

Input schema:

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Returns the current architecture identity and revision, provider and region, human-authored constraints, compact components and semantic connections, locked component IDs, and current analysis metrics when available. It deliberately omits Zustand internals, activity/history, metadata, XYFlow objects, and component positions.

Metrics are marked `current`, `stale`, or `unavailable`. Stale analysis is never presented as current.

### `inspect_component`

Input schema:

```json
{
  "type": "object",
  "properties": {
    "componentId": { "type": "string", "minLength": 1, "maxLength": 128 }
  },
  "required": ["componentId"],
  "additionalProperties": false
}
```

Returns one component's typed configuration, provider/service mapping, region, availability zones, replica count, locks, critical state, planning cost, and incoming/outgoing relationships. An unknown ID returns `COMPONENT_NOT_FOUND`.

### `analyze_architecture`

Input schema:

```json
{
  "type": "object",
  "properties": {
    "focus": {
      "type": "string",
      "enum": ["all", "cost", "resilience", "security", "validation"],
      "default": "all"
    }
  },
  "additionalProperties": false
}
```

Runs the same deterministic analysis action used by the human UI. It returns estimated monthly cost, resilience and security scores, validation status, evaluated constraints, and bounded structured findings. It also opens the Analysis panel so the human sees the agent-triggered result.

The focus filters returned findings only; all metrics and constraints are still calculated.

### `simulate_failure`

Input schema:

```json
{
  "type": "object",
  "properties": {
    "scope": {
      "type": "string",
      "enum": ["component", "availability-zone", "region"]
    },
    "target": { "type": "string", "minLength": 1, "maxLength": 128 }
  },
  "required": ["scope", "target"],
  "additionalProperties": false
}
```

Runs the same non-mutating simulation action used by the human UI. It returns status, failed and degraded component IDs and counts, impacted edge IDs, surviving component count, critical-path reachability, explanation, and bounded findings. It opens the Simulation panel and activates the failed/degraded canvas overlay without changing Architecture IR, persistence, activity, or undo history.

An unsupported target returns `INVALID_FAILURE_TARGET`.

## Agent Edit Mode

Only a human using the AetherSketch UI can enable Agent Edit Mode. Enabling it preserves the four read tools and dynamically registers exactly five narrowly scoped mutation tools:

### `add_component`

Adds one typed catalog component. The agent can provide `kind` plus optional name, region, availability zones, replicas, critical state, and kind-specific configuration overrides. Catalog defaults supply provider mapping, service, cost, and all omitted configuration. AetherSketch chooses an unoccupied canvas position; XY coordinates, IDs, metadata, cost, provider/service overrides, and lock state are not exposed.

### `update_component`

Updates one component by ID using an allowlist: name, region, availability zones, replicas, critical state, and kind-specific configuration. This is not arbitrary object patching. Zod validates configuration against the selected component's discriminated configuration schema. A locked component returns `COMPONENT_LOCKED` without changing Architecture IR.

### `remove_component`

Removes one unlocked component by ID. The existing domain action also removes its connected edges so the architecture cannot contain dangling references. Locked components return `COMPONENT_LOCKED`.

### `connect_components`

Creates a semantic connection from source component ID to target component ID with a required connection type and optional protocol and encryption state. Both endpoints must exist and self-connections fail with `INVALID_CONNECTION`.

### `disconnect_components`

Removes one connection by ID. Missing connections return `EDGE_NOT_FOUND`.

All five mutations execute the existing Architecture store actions with `actor="agent"`. The canvas updates from the resulting IR, the affected item is selected/focused where appropriate, activity history records the agent, existing analysis becomes stale, and active simulation is cleared. The tools never mutate XYFlow objects directly.

There is deliberately no `unlock_component`, `lock_component`, `set_constraints`, or generic arbitrary-action tool. Locks, constraints, and edit authorization are human controls.

## Agent-session checkpoint and activity

Enabling Agent Edit Mode captures a deep-cloned Architecture IR checkpoint after the human has set constraints and locks. It is held only in transient WebMCP UI state. The comparison engine runs deterministic analysis against the checkpoint and current IR, then reports before/after/delta cost, resilience, and security values together with ID-based added, changed, and removed entities.

Successful WebMCP analysis and simulation calls append agent activity immediately, as do all mutation store actions. A mutation rejected with `COMPONENT_LOCKED` produces a visible blocked activity entry while preserving the architecture. Other recoverable tool failures are recorded with their structured code and message. These activity writes do not increment the Architecture revision or create undo history.

## Results and errors

Every callback returns one of these compact envelopes:

```ts
type ToolResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        componentId?: string;
        edgeId?: string;
        details?: unknown;
      };
    };
```

Zod validates callback inputs as a defense-in-depth boundary in addition to the registered JSON Schema. Unknown or additional input properties produce `INVALID_INPUT`. Kind-incompatible configuration produces `INVALID_CONFIGURATION`. Domain errors preserve actionable codes such as `COMPONENT_LOCKED`, `COMPONENT_NOT_FOUND`, `EDGE_NOT_FOUND`, `INVALID_CONNECTION`, `INVALID_FAILURE_TARGET`, and `INVALID_ARCHITECTURE`. Invocation cancellation produces `EXECUTION_ABORTED`.

A retained reference to a mutation tool cannot bypass authorization: tool execution checks Edit Mode before input parsing, yields once, and checks Edit Mode again immediately before the synchronous domain action. If the human disables editing while a call is in flight, it returns `EDIT_MODE_DISABLED` and performs no mutation.

The four read tools declare:

```json
{
  "readOnlyHint": true,
  "untrustedContentHint": false
}
```

Analysis and simulation update transient presentation state, but they do not mutate the Architecture IR, so they remain read-only in the architectural sense. Outputs come from validated application state rather than external or user-controlled web content.

The five mutation tools declare `readOnlyHint: false` and `untrustedContentHint: false`.

## Hard invariants and soft goals

AetherSketch distinguishes deterministic domain invariants from human architecture goals:

- **Hard invariants** are always enforced. Examples include valid kind-specific configuration, existing component/edge references, unique IDs, no self-connections, schema-valid Architecture IR, human locks, and current Edit Mode authorization.
- **Soft goals** are evaluated by analysis rather than blocking every intermediate step. Budget, resilience/security targets, required region, Multi-AZ, and encryption-at-rest constraints may temporarily be unmet during a multi-step transformation. Mutation results mark analysis stale, and the final architecture can be evaluated with `analyze_architecture`.

`CONSTRAINT_VIOLATION` is reserved for a future constraint explicitly classified as a hard guardrail; the current human constraints are goals and do not use it.

## Runtime lifecycle

The application mounts a single WebMCP runtime boundary:

1. If `document.modelContext.registerTool` is absent, status is **WebMCP Unavailable** and the human workspace continues normally.
2. If the API is present, status changes to **WebMCP Initializing**.
3. The four read descriptors register concurrently through `document.modelContext.registerTool` with one long-lived owning `AbortSignal`.
4. When all registration promises resolve, status becomes **WebMCP Ready · 4 read tools**.
5. A rejected registration produces **WebMCP Error** and exposes its message in development diagnostics.
6. When the human enables Agent Edit Mode, a second `AbortController` registers the five mutation descriptors. The UI reports **4 read tools · 5 edit tools** only after all five registrations resolve.
7. Disabling Agent Edit Mode immediately revokes domain permission and aborts only the edit controller. The five mutation tools disappear, the four read-tool registrations and architecture changes remain, and the UI returns to Review Mode.
8. Each new enable cycle creates one new edit controller. Effect cleanup aborts the previous controller, so repeated cycles cannot accumulate duplicate tools.
9. When the React runtime unmounts, both owning signals are aborted.

“Ready” means tools are registered on the page. It does not claim that ChatGPT or another agent is connected.

There is no invented `unregisterTool()` call. Teardown uses the actual registration `AbortSignal` lifecycle. In development, the bug icon beside the top-bar status opens a compact diagnostic panel containing mode, separate read/edit registrations, last invocation, and last result or error. This panel is excluded from production builds.

## Browser requirements and fallback

WebMCP is a proposed API under active development. The page requires a secure, origin-isolated browser context that exposes the imperative `document.modelContext.registerTool` method. Feature detection checks the method itself rather than treating any `modelContext` object as support.

Unsupported browsers retain the complete human editor, deterministic analysis, simulation, import/export, history, and local persistence. No polyfill, extension requirement, fake registration, or degraded application mode is introduced.

## Testing with ChatGPT's in-app browser

1. Start AetherSketch locally or open its deployed Cloudflare URL in a ChatGPT in-app browser that exposes WebMCP.
2. Wait for the compact indicator to show **WebMCP Ready · Review · 4 tools**.
3. Ask ChatGPT to use `get_architecture`, inspect a returned component ID, analyze a focus such as security, and simulate a component or availability-zone failure.
4. Confirm that analysis opens the Analysis panel and simulation opens the Simulation panel with failed/degraded canvas styling.
5. Lock a component and set any desired human constraints in the UI.
6. Click **Enable editing**, confirm **WebMCP Ready · Agent Edit · 9 tools**, and ask ChatGPT to make a bounded change.
7. Confirm the canvas and Agent activity entry update, and confirm an attempted update/removal of the locked component returns `COMPONENT_LOCKED`.
8. Click **Disable editing**, confirm the indicator returns to **Review · 4 tools**, and inspect the automatically opened baseline comparison. Existing architecture changes remain.
9. In a development build, open WebMCP diagnostics to inspect the exact last invocation and result.

The complete repeatable three-minute story, including exact baseline and target scores, is documented in [`DEMO.md`](DEMO.md).

If the indicator stays **WebMCP Unavailable**, that browser surface does not currently expose the required API; continue using the human UI or test in a supported environment.

## Testing with Chrome's WebMCP mode

Follow the current [Chrome WebMCP setup guidance](https://developer.chrome.com/docs/ai/webmcp):

1. Open `chrome://flags/#enable-webmcp-testing`, enable it, and relaunch Chrome.
2. Load the AetherSketch local or deployed page and confirm the Ready status.
3. For Chrome's experimental built-in WebMCP debugging panel, also enable `chrome://flags/#devtools-webmcp-support`, relaunch, then use the WebMCP section of the DevTools Application panel to inspect schemas, manually invoke tools, and view their results.

The flags and DevTools location can change while WebMCP evolves; defer to the linked current Chrome documentation rather than assuming a browser version.

## Current API/type-package notes

AetherSketch compiles against the official upstream `webmcp-types` package, currently pinned through npm as `^0.1.5`. That package defines `Document.modelContext`, imperative `registerTool`, `getTools`, registration and execution abort signals, tool descriptors, and the two annotations used here.

The current draft specification has evolved ahead of that published type release in one consumer-facing area: it also documents `ModelContext.executeTool`, while `webmcp-types@0.1.5` does not yet declare it. AetherSketch is a tool provider and does not need to invoke that consumer method, so no local type augmentation or compatibility shim was added.

The available API does not define an output schema field, so AetherSketch returns compact structured objects from `execute` without inventing `outputSchema`. Registration teardown uses the specified abort signal because there is no `unregisterTool` method in the verified type surface.
