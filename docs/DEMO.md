# Canonical three-minute demo

AetherSketch uses the same live Architecture IR for the canvas, deterministic engines, and WebMCP tools. It does not embed a chatbot or send prompts to an LLM.

## Exact presentation script

1. Click **Reset Demo** to restore **Ecommerce Production**. Verify **5 components, 4 connections, $675/month, resilience 57, security 76**. Reset clears history, activity, simulation, selection, edit authority, and the prior comparison checkpoint. Obtain confirmation before resetting someone else's work; export it first if it must be retained.
2. Confirm **Review Mode · 4 tools**. Open **Explore WebMCP tools** to show two strictly read-only tools and two presentation/activity tools. The five graph-edit tools must say **Not registered**. Close the panel with Escape.
3. Ask: **“Analyze this architecture for production readiness. Do not modify anything.”** Show the Analysis panel and Agent activity. The architecture remains unchanged.
4. Select **Orders Database** (PostgreSQL) and click **Lock component**.
5. Set **Maximum monthly cost = 3000** and **Target resilience = 90** in Architecture Constraints. These human goals and the lock become the session checkpoint.
6. Ask: **“Improve this architecture to survive an availability-zone failure while staying below my budget. Keep PostgreSQL.”** Editing is not yet authorized; the agent should explain or plan rather than mutate.
7. Click **Enable editing** to enter **Agent Edit Mode · 9 tools**. Reopen **Explore WebMCP tools** to show dynamic registration, then close it. If the agent paused for authorization, tell it to continue with the same request.
8. Let the agent modify the architecture through the five edit tools. Use the reference redesign below for repeatable metrics. Show the live canvas and Agent activity. The locked primary must remain unchanged.
9. Click **Disable editing** after the redesign. Confirm four Review tools remain and the session comparison opens. Existing edits remain in the graph.
10. Ask: **“Simulate the loss of eu-west-1a.”** The tool uses `scope="availability-zone"` and `target="eu-west-1a"`. It opens the simulation panel and canvas overlay.
11. Show **degraded architecture, 0 failed components, 3 degraded components, critical path remaining**, then reopen the comparison to show **$675 → $1,288**, **57 → 100 resilience**, and **76 → 90 security**.

The copyable Demo prompts menu contains the three quoted prompts verbatim. Model choices may vary; these exact final metrics describe the tested reference redesign, not every valid response to the resilience request.

## Baseline

```text
Customer Traffic → Storefront CDN → Public Application Load Balancer
                                      → Storefront API → Orders Database
```

The API has one replica in `eu-west-1a`; PostgreSQL has one zone and native Multi-AZ disabled. The graph has no WAF, queue, or secrets manager. These deliberate weaknesses generate actionable findings.

## Reference redesign

Discover IDs with `get_architecture`; inspect configuration as needed. Never invent generated IDs. Keep the primary PostgreSQL component locked, with its original configuration and placement.

| Operation               | Reference change                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update_component`      | Storefront API: 2 replicas, `eu-west-1a` and `eu-west-1b`, autoscaling enabled                                                                                             |
| `add_component`         | WAF named Storefront WAF, marked critical; catalog configuration defaults                                                                                                  |
| `connect_components`    | CDN → WAF and WAF → load balancer; request, HTTPS, encrypted                                                                                                               |
| `disconnect_components` | Remove the old direct CDN → load balancer bypass; confirm this destructive browser action when requested                                                                   |
| `add_component`         | Queue named Order Buffer; dead-letter queue and encryption enabled                                                                                                         |
| `connect_components`    | Storefront API → Order Buffer; async, HTTPS, encrypted                                                                                                                     |
| `add_component`         | Secrets manager named Application Secrets; automatic rotation enabled                                                                                                      |
| `connect_components`    | Application Secrets → Storefront API; management, HTTPS, encrypted                                                                                                         |
| `add_component`         | SQL database named Orders Failover Replica in `eu-west-1b`; PostgreSQL, native Multi-AZ false, encrypted, backups enabled, public access false, remaining catalog defaults |
| `connect_components`    | Locked primary → failover replica; replication, PostgreSQL/TLS, encrypted                                                                                                  |
| `analyze_architecture`  | Recompute all metrics after the final edit                                                                                                                                 |

Connections to a locked component are allowed; updates/removal of that component are not. An attempted primary mutation returns `COMPONENT_LOCKED` and a blocked Agent activity entry. A browser may independently require confirmation or reject an action; never bypass that control.

The existing load-balancer → API HTTP edge is left as modeled in this reference. Do not enable native Multi-AZ on the primary or add a third API replica when demonstrating the exact cost below.

| Metric                   | Before |  After |   Delta |
| ------------------------ | -----: | -----: | ------: |
| Components / connections |  5 / 4 |  9 / 8 | +4 / +4 |
| Estimated monthly cost   |   $675 | $1,288 |   +$613 |
| Resilience               |     57 |    100 |     +43 |
| Security                 |     76 |     90 |     +14 |

The resilience-only eval case can finish at $1,245 without WAF/secrets improvements. Use this full reference for the $1,288 / 100 / 90 presentation.

## Failure and comparison evidence

The eu-west-1a failure degrades the load balancer, Storefront API, and locked primary database. The independent replica in eu-west-1b survives, and every modeled critical component remains reachable. Impacted edges show reduced capacity. This is a graph projection, not proof of actual cloud failover, remaining throughput, or zero data loss.

Simulation changes no Architecture IR or undo history. Agent simulations append saved activity; the overlay itself is transient. Comparison uses immutable Architecture IR snapshots and stable IDs, not activity prose. The checkpoint contains the human constraints and lock captured when editing was enabled.

## Repeat or recover

Use **Reset Demo** to return to the baseline. It does not change the selected theme. If WebMCP is unsupported, the human editor, analysis, simulation, import/export, and reset still work. If storage is unavailable/full, export before closing. If analysis fails, the model remains editable and analysis can be retried; do not present stale metrics as a new result.
