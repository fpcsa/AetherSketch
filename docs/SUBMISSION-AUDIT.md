# AetherSketch — final hackathon audit

Audit date: 30 August 2026. Scope: repository hardening, existing deployment verification, deterministic tests, and in-app browser QA. No major product features were added and no public deployment was performed.

**Recommendation: GO for the hardened code; NO-GO for final submission until this build is deployed and the public demo is rechecked.** The existing public deployment works, but it predates this patch. Publishing was not part of the permission granted for this audit.

Public URL verified: [AetherSketch](https://aethersketch.projects-engineering.workers.dev). Repository: `/Users/macmini/fpcsa/AetherSketch`. Changes are in the working tree, including new files; they have not been committed.

**Judge-style scores**

These are reviewer estimates for the hardened implementation, not official challenge results.

| Criterion             | Score | Evidence and practical limit                                                                                                                                                                                                                                           |
| --------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebMCP Leverage       |  9/10 | Live discovery, strict schemas, two truly read-only tools, visible analysis/simulation, dynamic 4→9→4 registration, locks, revocable authority, recoverable errors, and shared human/agent IR demonstrated. Large kind-specific schemas and browser dependency remain. |
| Execution             |  8/10 | Two complete browser demo replays reproduced exact metrics; 201 tests, production routing, imports, reset, permission lifecycle, and keyboard node edits pass. Desktop layout and incomplete keyboard connection creation limit accessibility.                         |
| Potential Impact      |  8/10 | Shared inspectable architecture and controlled agent edits are useful for design reviews and education. No actual provider pricing, infrastructure deployment, capacity validation, or multi-user collaboration.                                                       |
| Creativity & Ambition |  8/10 | Semantic canvas tools, human-owned constraints, protected decisions, comparison and visible failure projection form a coherent demo. Intelligence remains a deterministic planning model.                                                                              |

**Findings fixed**

1. Duplicate connections with different IDs were accepted. A source/target/type relationship is now unique in the domain store and import schema. Tool rejection is `INVALID_CONNECTION`, preserving graph, history and simulation.
2. Imports read the entire file before checking length and could overwrite newer work after asynchronous reading. Files over 16 MB are rejected before reading; the existing 4,000,000-character and bounded traversal checks remain. Reset, newer imports, and intervening IR edits invalidate pending imports.
3. Keyboard node movement previously changed XYFlow state without updating Architecture IR. Enter/Space selection and arrow movement now go through shared selection/domain actions; movement participates in revision and undo. Canvas deletion checks dependent network references before XYFlow can remove incident edges.
4. WebMCP details were only exposed through development diagnostics. Production now has a live tool directory showing registered/unregistered tools, effects, human authority, registration failure guidance and structured error feedback.
5. The minimum-width toolbar clipped the editing control. It wraps at narrow desktop widths; the canvas heading can wrap, and overlays remain inside the viewport. Long activity text wraps instead of overflowing. Dark-theme muted text is clearer.
6. Focused panels now accept Escape and return focus to their opener. The canvas skip-link target is focusable. These are non-modal panels; normal keyboard navigation can leave them.
7. Intelligence-store subscriptions are disposed on hot-module replacement. Existing effects and registration ownership avoid duplicate production subscriptions/registrations.
8. Tool descriptions now explicitly identify planning estimates, duplicate-connection rules and dependency removal requirements. README immediately links the deployed app, license, tools and exact demo; it states browser, model and persistence limitations.
9. Restored React Flow attribution to remove the development warning about hiding it. The existing AGPL-3.0-or-later repository license is unchanged. This is a credit/console cleanup, not a legal certification.

**Audit evidence**

| Audit area            | Result                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebMCP leverage       | Actual browser discovery returned four Review tools; enabling editing returned nine; disabling returned four. Successful tool calls visibly updated the same canvas and comparison.                                                                                                                                                                                                            |
| First 30 seconds      | Ecommerce is loaded immediately; estimated cost and scores are visible. The empty inspector explains the cloud editor and initial agent Review authority. Production tool directory exposes the integration.                                                                                                                                                                                   |
| Demo reliability      | One full development replay and one full production-preview replay reached 9 nodes/8 edges, $1,288, resilience 100 and security 90. Both used a locked primary, $3,000 budget and resilience target 90.                                                                                                                                                                                        |
| Reset and refresh     | Reset restored 5 nodes/4 edges, $675, 57/76 scores, disabled undo/redo, cleared simulation and comparison, and retained only four Review tools. Refresh during Edit preserved the graph but returned to Review and cleared the transient simulation.                                                                                                                                           |
| Simulations           | Production AZ simulation repeated with identical results: degraded, zero failed, three degraded, critical path remaining. Invalid AZ cleared the previous overlay. Compact IR before/after simulation was identical.                                                                                                                                                                           |
| Tool quality          | Names, descriptions, strict argument parsing, kind-specific configuration, output envelopes and side-effect annotations reviewed for all nine tools. Get/inspect use `readOnlyHint: true`; all other tools use false. All mark returned imported content untrusted.                                                                                                                            |
| Responsive layout     | Visually inspected 1000×640, 1366×768, 1440×900 and 1920×1080, including dark and light themes. Canvas controls and score panels remained accessible; dense graphs at minimum width require zoom. At 390×844 the app remains 1000 pixels wide: mobile layout is not supported.                                                                                                                 |
| Accessibility         | Browser verified node keyboard selection/movement/undo and Escape/focus return for panels. Simulation uses text, icons and dashed paths, not color alone. Edge keyboard handling was reviewed in code, but direct SVG key dispatch in the browser bridge could not be independently verified. Connection creation still requires a pointer. No screen-reader or WCAG certification is claimed. |
| Performance           | No runaway rendering or registration loop observed during replays. No errors in the production console. Final fresh local page had no warning/error logs after attribution restoration. No load/stress benchmark was performed.                                                                                                                                                                |
| Repository and claims | README, demo, tool/security/deployment docs reviewed. Existing license preserved. Pricing, resilience, security and simulation are explicitly estimates/models, with no real cloud access or infrastructure provisioning claim.                                                                                                                                                                |

The two complete replays preceded the final attribution-only cleanup. After that cleanup the full validation suite was rerun, and a fresh browser tab verified the running repository and visible attribution.

**Adversarial coverage**

| Case                                               | Verified result                                                   | Evidence surface                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Agent edit in Review / retained callbacks          | `EDIT_MODE_DISABLED` or `TOOL_UNAVAILABLE`; no commit             | Unit/integration tests; browser discovery confirms edit tools absent                  |
| Locked component removal                           | `COMPONENT_LOCKED`; primary unchanged                             | Browser WebMCP + tests                                                                |
| Missing component ID                               | `COMPONENT_NOT_FOUND`                                             | Browser WebMCP + tests                                                                |
| Duplicate typed connection                         | `INVALID_CONNECTION`; graph/history/simulation preserved          | Browser WebMCP + regression test                                                      |
| Invalid kind configuration                         | `INVALID_CONFIGURATION` with bounded details                      | Browser WebMCP + tests                                                                |
| Invalid JSON import                                | Error notice; current project preserved                           | Browser file chooser + tests                                                          |
| Huge/hostile import strings                        | Size/depth/traversal rejection, inert React rendering             | Automated import/security tests; new pre-read size test                               |
| Slow/out-of-order imports                          | Reset/newer edits/latest import win                               | New asynchronous integration tests                                                    |
| Invalid AZ after valid simulation                  | `INVALID_FAILURE_TARGET`; stale overlay removed                   | Browser WebMCP + tests                                                                |
| Component with network dependents                  | Rejected until references detached                                | Existing domain/tool tests and reviewed canvas deletion guard                         |
| Mode revoked during operation                      | Authority rechecked before synchronous commit                     | Existing async tool/registration tests                                                |
| Repeated registration                              | Owned abort signals; stale callbacks revoked, 4→9→4 lifecycle     | Browser cycles, StrictMode/registration tests                                         |
| Browser without WebMCP / failed registration       | Human editor stays usable; status is truthful                     | Automated app/feature-detection tests (no separate unsupported physical browser used) |
| Corrupt/blocked/full localStorage, undo and import | Recovery notice or memory fallback; valid state/history preserved | Existing store/integration tests; real browser refresh and reset                      |

**Exact final demo**

Use the accompanying `FINAL-DEMO.md` (the repository's `docs/DEMO.md`). It contains all eleven presentation steps and every reference graph operation. The key sequence is:

1. Reset Demo; show 5 nodes, 4 edges, estimated $675/month, resilience 57, security 76.
2. Show Review and the live directory: four registered tools, five edit tools not registered.
3. Ask: “Analyze this architecture for production readiness. Do not modify anything.” Show Analysis and Agent activity.
4. Select Orders Database and lock it. Set maximum monthly cost 3000 and target resilience 90.
5. Ask: “Improve this architecture to survive an availability-zone failure while staying below my budget. Keep PostgreSQL.” The agent must await authority.
6. Enable editing and show nine tools. Update API to two replicas across eu-west-1a/b with autoscaling; add WAF, encrypted DLQ queue, rotating secrets manager and independent PostgreSQL replica in eu-west-1b. Connect them exactly as documented; remove the direct CDN→load-balancer bypass.
7. Analyze again: 9 nodes, 8 edges, $1,288, resilience 100, security 90. The locked primary's original configuration remains unchanged.
8. Disable editing; show four tools and before/after comparison.
9. Ask: “Simulate the loss of eu-west-1a.” Show degraded status, zero failed, three degraded, critical path remaining, and visible degraded paths.
10. Reset Demo to prove repeatability. Explain that all numbers and failure behavior are planning-model results.

**All WebMCP tools**

| Tool                    | Available mode | readOnlyHint | Effect                                                                       |
| ----------------------- | -------------- | ------------ | ---------------------------------------------------------------------------- |
| `get_architecture`      | Review + Edit  | true         | Compact live graph, constraints, locks, cached metrics                       |
| `inspect_component`     | Review + Edit  | true         | Typed configuration and relationships                                        |
| `analyze_architecture`  | Review + Edit  | false        | Fresh deterministic findings; Analysis panel and saved activity              |
| `simulate_failure`      | Review + Edit  | false        | Transient failure overlay, findings and saved activity                       |
| `add_component`         | Edit only      | false        | Add validated catalog component                                              |
| `update_component`      | Edit only      | false        | Update permitted fields on unlocked component                                |
| `remove_component`      | Edit only      | false        | Remove unlocked component plus incident edges; reject outstanding references |
| `connect_components`    | Edit only      | false        | Unique typed connection between valid IDs                                    |
| `disconnect_components` | Edit only      | false        | Remove one existing connection                                               |

Review tools never mutate Architecture IR. Only human controls grant editing, manage locks and set constraints. Constraints are soft analysis goals; locks, schemas, references and current permission are hard application invariants. This does not authenticate or sandbox arbitrary same-origin JavaScript. The API/annotation review used the [26 August WebMCP draft](https://webmachinelearning.github.io/webmcp/) and [Chrome's tool-security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

**Verification commands and results**

Final application checks ran in `/Users/macmini/fpcsa/AetherSketch`, using the installed Node 24.19.0 runtime and dependencies. No dependency upgrades were made.

| Command/check                                                                                     | Result                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                                                    | PASS, exit 0                                                                                                                                                                             |
| `npm run typecheck`                                                                               | PASS, exit 0                                                                                                                                                                             |
| `npm run format:check`                                                                            | PASS; all matched files formatted                                                                                                                                                        |
| `npm test`                                                                                        | PASS; 23 files, 201 tests (baseline: 22 files, 193 tests)                                                                                                                                |
| `npm run eval:webmcp`                                                                             | PASS; 10 deterministic reference cases. These are included in the 201 tests, and were also rerun separately. Not an LLM success-rate measurement.                                        |
| `npm run build`                                                                                   | PASS; TypeScript + Worker + client production build. Also rerun by `test:production`. Final main client JS about 295.81 kB raw / 76.35 kB gzip, with separate React/XYFlow/icons chunks. |
| `npm run test:production`                                                                         | PASS; GET/HEAD health, 405/Allow, JSON API 404s, SPA direct navigation/repeated refresh, eight entry/preload/icon assets, MIME and cache/security headers                                |
| `WRANGLER_LOG_PATH=.wrangler/logs npx --no-install wrangler deploy --dry-run`                     | PASS, exit 0; generated Worker/assets configuration validated, no publication                                                                                                            |
| `git diff --check`                                                                                | PASS                                                                                                                                                                                     |
| `npm run dev -- --port 5174 --strictPort`                                                         | Isolated dev server started for browser QA                                                                                                                                               |
| `npm run preview -- --port 4174 --strictPort`                                                     | Isolated production preview started for browser QA                                                                                                                                       |
| In-app Browser / actual WebMCP                                                                    | Two complete scripted replays; lifecycle, metrics, simulations, reset, refresh, invalid tools, import and keyboard node behavior observed as described above                             |
| HTTPS `curl --max-time 20 -sS` against public `/`, `/judge/review`, `/api/health`, `/api/missing` | PASS: 200 SPA, 200 SPA, 200 correct health JSON, 404 JSON respectively. Health `Cache-Control: no-store` confirmed.                                                                      |

There is no standalone unattended browser e2e command in package.json. Browser QA above is a live, agent-controlled scripted check, not a new CI e2e suite. Test watch mode, formatting mutation, deployment and Cloudflare type generation were not treated as verification commands.

Initial environment-only failures were resolved: a symlinked dependency cache was read-only, so installed dependencies were copied into the isolated workspace; local preview needed sandbox network permission. A Python HTTPS attempt failed due to that runtime's local CA configuration; curl then verified public HTTPS without disabling certificate checks. These failures are not counted as passing tests or deployments.

**Remaining weaknesses and release gate**

- The hardened build is not public yet. Deploy from the reviewed repository, then rerun the canonical demo and route checks at the actual public origin before submission.
- WebMCP browser availability varies. Only the in-app browser was exercised live in this audit; unsupported/registration-failure behavior has automated coverage.
- Desktop minimum is 1000×640. Dense graphs need zoom; phone layout and pointer-free connection creation remain outside current capability.
- No production cloud pricing, capacity/failover guarantee, security certification, real account integration or multi-user sync. Architecture/history live unencrypted in browser storage; do not enter secrets.
- Thirty component kinds produce relatively large add/update schemas. Large graphs can exceed convenient agent context budgets. No stress benchmark, external accessibility audit or multi-model autonomous evaluation was performed.

**Final submission recommendation: NO-GO until the hardened build is deployed and rechecked publicly.** All requested local hardening and available validation are complete. The existing deployment was verified, but no new deployment is claimed.
