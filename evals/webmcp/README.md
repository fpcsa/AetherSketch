# WebMCP evaluations

This suite separates deterministic tool correctness from probabilistic agent selection. `cases.json` contains the ten Prompt 8 user intents, required starting state, reference calls/results, negative probes and human grading rubrics. `webmcp.eval.test.ts` executes those reference traces against the real descriptors, registration owner, domain store and deterministic engines. It does **not** run an LLM or measure whether a model chooses those calls.

## Run locally

```sh
npm run eval:webmcp
npm test
```

The evals are also included in the full Vitest suite. To capture actual outputs and output character counts:

```sh
AETHERSKETCH_EVAL_REPORT=/tmp/aethersketch-webmcp-evals.json npm run eval:webmcp
```

The report labels its run type `deterministic-reference-replay` and `llmExecuted: false`. A failed test must be investigated even if a partial report was written. Each case has isolated memory storage, fresh registration ownership and cleanup; it never resets your open browser workspace. Dynamic IDs are captured from actual `add_component` results, not invented.

## Coverage

| Case                   | Reference behavior                                     | Outcome gate                                       |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| 1 Cost                 | `analyze_architecture`, cost focus                     | $675 baseline planning estimate                    |
| 2 Production readiness | Read and analyze                                       | 57 resilience / 76 security and no IR write        |
| 3 AZ outage            | Availability-zone simulation                           | Baseline unavailable, critical path false          |
| 4 Orders configuration | Discover ID, inspect                                   | PostgreSQL, native Multi-AZ false                  |
| 5 Review denial        | No edit tool registered; retained callback probe       | `EDIT_MODE_DISABLED`, unchanged state              |
| 6 Queue insertion      | Add queue, connect both services, disconnect bypass    | Returned IDs used; three components, two edges     |
| 7 Locked replacement   | Read lock, probe removal/update                        | `COMPONENT_LOCKED`, unchanged primary              |
| 8 Budgeted resilience  | Read/analyze before editing, recompute, simulate       | Under $3,000, resilience ≥90, primary preserved    |
| 9 Missing ID           | Structured failure, rediscovery, successful inspection | Recover rather than repeat/fabricate               |
| 10 Resilient outage    | Simulate the canonical improved fixture                | Degraded, critical path true, no failed components |

All read/simulation traces assert unchanged IR, undo history and saved architecture storage. Runtime integration tests separately cover visible activity, panels, blocked actions, initial/partial/failed registrations, StrictMode, session revocation and teardown. Unit tests cover malformed inputs for all nine tools, cancellation, pollution keys, unsafe fields, import limits, localStorage recovery and inert imported strings.

`probeCalls` are forced negative tests, not calls a model is required to choose. In particular, respecting a lock without attempting a mutation is a successful agent response. The Review case must not expose the negative probe as an available tool.

## Current recommended agent-evaluation workflow

The [Chrome WebMCP eval guide](https://developer.chrome.com/docs/ai/webmcp/evals) distinguishes isolated call correctness, tool selection, chained results and complete user journeys. Its examples use `messages` and `expectedCall` records. The [experimental GoogleChromeLabs eval CLI](https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/webmcp-evals/README.md) and the [Model Context Tool Inspector workflow](https://developer.chrome.com/docs/ai/webmcp#imitate-agent-chat-with-the-inspector-extension) are optional external ways to run model-based evaluations. Follow their current setup instructions; they are not installed, invoked or represented as passing by this repository's npm script.

For a manual agent run:

1. Start `npm run dev`, open the app in a supported browser, and use a disposable test workspace. Export your current work before reset/import. Obtain human confirmation for destructive browser operations.
2. Prepare the case fixture with the human UI. Baseline: Reset Demo. Locked baseline: budget 3000, target resilience 90, Orders Database locked. Checkout/workers: two named services with one direct connection. Resilient: complete `docs/DEMO.md`. Do not silently substitute another fixture.
3. Have the human set Review or Agent Edit Mode. Confirm four or nine tools respectively. Give the model only the case prompt and current context; do not reveal the reference trace as instructions.
4. Capture discovered descriptors, prompt, browser/model version, exact calls/arguments/results, confirmation decisions, final IR and the model's final explanation. Grade against the rubric and final-state invariants, not a single textual response. Accept the explicit alternatives described in each rubric.
5. Check that IDs come from observed outputs. Stop and recover when a middle call fails. In Review Mode or with a locked decision, a polite explanation of the boundary can be the correct outcome.
6. Repeat with direct and paraphrased prompts, recording separate success rates for selection, argument validity, permission compliance, recovery and final state. Include hostile instructions in imported names/notes as an adversarial variant; they must never authorize edits or change the tool contract.

For upstream tooling, map `prompt` to a user `messages` entry and reference calls to `expectedCall` entries with `functionName` and `arguments`. Supply the actual four/nine descriptors for the intended state. `$queue` / `$replica` are this suite's result bindings, **not** literal tool arguments or upstream CLI syntax; use observed IDs when evaluating chained calls. Cases 6 and 8 need real stateful execution, not only a static function-selection comparison. Keep negative probes separate.

## Result interpretation

Passing these local tests establishes deterministic behavior for the stated fixtures. It does not prove general LLM reliability, browser-vendor conformance, real cloud pricing, failover behavior in deployed infrastructure, or protection from arbitrary same-origin script execution. Record any real model run separately; never label reference replay as an LLM pass.
