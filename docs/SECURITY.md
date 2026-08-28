# Security and authority model

The repository-level [SECURITY.md](../SECURITY.md) documents the threat model, imported data, prompt injection, limits and disclosure policy. This document focuses on authority flow.

## Purpose

AetherSketch treats agent editing as temporary delegated authority, not as implicit ownership of the workspace. The browser page remains the policy and validation boundary; ChatGPT is the copilot, and no embedded LLM or backend inference service exists.

This document describes application-level authority boundaries for the hackathon MVP. It is not a claim of production sandboxing, cloud-account authorization, or infrastructure security certification.

## Authority split

### Human

Only the human UI can:

- enable or disable Agent Edit Mode;
- lock or unlock architectural components;
- set budget, region, resilience, security, Multi-AZ, and encryption goals;
- import, reset, undo, or redo the project.

Review Mode is always the default after a runtime starts. Disabling editing does not revert already accepted architecture changes.

Enabling editing captures a read-only comparison checkpoint of the current IR, including human locks and constraints. The checkpoint grants no capability, is not persisted, and is cleared by project loads/imports and Reset Demo.

### Agent

The agent can always use four registered read tools in supported browsers to inspect, analyze, and simulate the live Architecture IR. It can mutate only while the human has enabled Agent Edit Mode, and then only through five allowlisted operations: add, update, remove, connect, and disconnect.

The agent cannot change edit authorization, locks, constraints, raw metadata, generated IDs, provider/service mappings, cost estimates, canvas coordinates, history, or arbitrary store fields. There is no generic execution tool.

### AetherSketch

AetherSketch owns:

- strict JSON Schema descriptors and runtime Zod validation;
- edit-permission checks before parsing and immediately before mutation;
- kind-specific configuration validation;
- locked-resource enforcement in the domain store;
- complete Architecture IR validation before every commit;
- agent attribution in activity history;
- deterministic analysis and failure simulation;
- registration cleanup through the WebMCP `AbortSignal` lifecycle.

## Mutation authorization flow

```text
Mutation tool registered
  → Agent Edit Mode still enabled
  → Input matches strict schema
  → Component configuration matches its kind
  → Domain operation is valid
  → Locked-resource check passes
  → Validated IR commit with actor="agent"
```

Every layer is intentional defense in depth. Dynamic tool removal limits discoverable capability, while the execution-time permission check prevents a cached tool reference or in-flight call from bypassing a human disable. The domain store independently enforces ready edit permission, allowlisted agent fields, human-only controls, and component locks for update and removal. Retired registration callbacks remain revoked after a new session begins.

## Registration lifecycle

The four read tools and five edit tools use different `AbortController` owners. Read registrations live for the runtime. Enabling editing creates one edit controller and registers exactly five tools with its signal. Disabling editing changes permission state first and aborts that controller; the browser lifecycle then removes those registrations. Repeated enable/disable cycles create fresh edit controllers, so registrations do not leak or duplicate.

AetherSketch does not call or emulate an `unregisterTool()` API that is not present in the verified WebMCP surface.

## Locks and constraints

A component lock is a human architectural decision. An agent can inspect the `locked` state but cannot set or clear it. Updating or removing a locked component returns a structured `COMPONENT_LOCKED` error with the component ID and performs no mutation.

Current architecture constraints are human-owned soft goals. They are visible to the agent through `get_architecture` and evaluated by deterministic analysis. A multi-step agent transformation may temporarily miss a budget, region, resilience, security, Multi-AZ, or encryption target; these do not block every intermediate mutation.

Hard invariants always fail closed: disabled edit permission, locks, malformed or kind-incompatible configuration, dangling endpoints, missing entities, duplicate IDs, self-connections, and invalid Architecture IR.

## Structured failures

Expected failures use machine-recoverable codes, including:

- `EDIT_MODE_DISABLED`
- `TOOL_UNAVAILABLE`
- `HUMAN_ACTION_REQUIRED`
- `COMPONENT_LOCKED`
- `COMPONENT_NOT_FOUND`
- `EDGE_NOT_FOUND`
- `INVALID_CONNECTION`
- `INVALID_CONFIGURATION`
- `INVALID_INPUT`
- `EXECUTION_ABORTED`

`CONSTRAINT_VIOLATION` is reserved for a constraint that is explicitly promoted to a hard guardrail. No current human goal is silently treated as one.

## Current limitations

- Agent Edit Mode is page-local and is not an identity or authentication system.
- Activity is a local product history, not a tamper-proof audit log.
- The application models architecture but cannot deploy infrastructure or access a cloud account.
- localStorage persistence is not suitable for secrets; Architecture IR should not contain credentials.
- WebMCP itself is an evolving browser API, so supported environments and lifecycle behavior must continue to be verified against the current specification and browser implementation.
