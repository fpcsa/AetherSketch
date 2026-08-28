# Security policy and threat model

AetherSketch is a local architecture modeler, not a cloud control plane. The browser product has no cloud credential fields, infrastructure deployment tools, embedded LLM, or inference backend. Its Worker exposes a health endpoint, not architecture mutation APIs. Repository deployment scripts publish only the application Worker and static assets using the owner's Cloudflare authorization. Do not enter secrets into names, notes, configuration, metadata, or imports.

## What is protected

The WebMCP boundary protects the current Architecture IR, human locks and constraints, and the distinction between Review and Agent Edit authority. Relevant threats are malformed or oversized tool arguments, stale callbacks, hostile JSON imports, prompt injection in user content, and unintended disclosure through tool outputs.

It is **not** authentication, a sandbox for arbitrary same-origin JavaScript, or a tamper-proof audit system. A user with DevTools, a compromised browser extension, or code already executing in this origin can alter client state or impersonate UI actions. Deployment security and real infrastructure resilience must be assessed separately.

## Permissions and locked resources

- Review Mode exposes four architecture-read tools. Only `get_architecture` and `inspect_component` have `readOnlyHint: true`; analysis and simulation also change presentation and activity.
- A human grants Agent Edit Mode through the UI. Exactly five additional tools can add, update, remove, connect, and disconnect modeled resources.
- Registration ownership, callback checks, and the domain store enforce permission separately. Registration must finish before edits execute. Disabling editing, a failed registration, or runtime teardown revokes authority. A new session does not revive old callbacks.
- Lock/unlock, constraints, import/reset, history navigation, and edit authorization are not WebMCP tools. Agent-attributed calls to human-only domain actions are rejected.
- Locked components cannot be updated or removed. Locks protect component configuration and existence, not graph isolation: connections to a locked component may be added or removed. This permits an independent database replica without modifying the locked primary. A human reviews topology and comparison before accepting a redesign.
- Budget, region and score constraints are soft goals evaluated by analysis; they may be unmet during intermediate steps. Schema validity, authority and locks are hard invariants.

The browser's origin controls are separate from these app checks. AetherSketch supplies no `exposedTo` allowlist and does not expose tools deliberately to other origins. See the [current Chrome security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

## Untrusted content and prompt injection

Names, identifiers, protocol labels, configuration strings and imported notes/metadata remain data. Schema validation proves shape, not trustworthiness or instruction authority. They cannot grant permissions, change tool definitions, unlock a component or become executable instructions.

Raw metadata, description, constraint notes, provider account references, history and UI state are omitted from `get_architecture`. Other tools also omit raw notes/metadata. Deterministic findings can interpolate a component name; successful mutations can echo names, IDs or protocols. Therefore each of the nine current descriptors has `untrustedContentHint: true`, based on its actual returned fields. This does not make computed numeric scores untrusted; the annotation covers a mixed response, not individual fields. The [tool table](docs/WEBMCP.md#tool-contract) lists the content sources.

Agents should treat returned text as quoted architecture data, ignore instructions embedded in it, and require human authorization independently. An annotation is advisory, not an injection detector or permission mechanism. AetherSketch does not send these strings to an LLM itself.

## Input and import validation

Tools use strict JSON Schema and runtime Zod validation, then existing domain validation before committing a change. Agent patches are allowlisted; kind-specific configuration keys/types are checked against the catalog schema. Unknown fields, bad IDs/types, self-connections, missing endpoints and invalid configuration produce structured errors without an IR mutation.

Before recursive parsing, tool inputs are bounded to 16,384 characters of traversed content, 256 values/keys and depth 8. Configuration patches allow at most 16 fields and 240-character strings; other domain fields have tighter bounds. JSON traversal rejects reserved `__proto__`, `constructor` and `prototype` keys, accessors, non-plain objects and cycles. No recursive object merge or executable import is supported.

Imports are limited to 4,000,000 serialized characters and bounded traversal (depth 24, 150,000 values). The schema caps graphs at 1,000 components and 5,000 connections. Persisted snapshots have separate depth/size/count limits and at most 100 past/future states and 500 activity entries. Malformed stored data restores the canonical demo with a recovery notice; the corrupt source is not overwritten during hydration. A later edit may replace that saved snapshot.

React renders ordinary text and attributes; imported HTML/JavaScript is not inserted as executable markup. Tests import script/image-handler strings and inspect the rendered DOM. Unknown runtime errors are redacted, validation issues are bounded, and debug invocation records contain only validated arguments.

## Client-side persistence and disclosure

Architecture, undo history and activity are stored in this origin's localStorage, without encryption. Other scripts/extensions with origin access may read them. Tool discovery and execution can disclose architecture data to the user's browser agent. Never use real account identifiers or confidential infrastructure details in shared demos. Exported JSON retains metadata; inspect it before sharing.

If storage is unavailable or a write fails, the current store continues in memory and displays a persistent warning. The last successful saved snapshot remains; export current changes before reload or closing the tab. Analysis/render failures do not imply that unsaved work is durable. Production asset headers preserve origin isolation and same-origin tool permissions; they do not authenticate an agent.

## Reporting

Do not publish credentials, private architecture exports or exploit payloads containing personal data in public issues. Use the repository host's private vulnerability reporting channel if enabled; otherwise contact a maintainer privately before disclosure. Include the affected commit, browser version, minimized input, expected boundary and observed result. No private reporting endpoint or response SLA is claimed here.

For reproducible checks and the distinction between deterministic replay and LLM evaluation, see [WebMCP evals](evals/webmcp/README.md).
