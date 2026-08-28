# Canonical three-minute demo

This walkthrough is the repeatable hackathon story for AetherSketch. It uses deterministic application state and WebMCP tools; AetherSketch never sends a prompt to an LLM or embeds a chatbot.

## Starting state

Open the application and click **Reset Demo** if the workspace has been used before. The Ecommerce Production architecture loads immediately:

```text
Customer Traffic
  → Storefront CDN
  → Public Application Load Balancer
  → Storefront API
  → Orders Database
```

The deterministic baseline is:

| Metric                      |      Value |
| --------------------------- | ---------: |
| Estimated architecture cost | $675/month |
| Resilience                  |     57/100 |
| Security                    |     76/100 |

The low resilience score is intentional: Storefront API has one replica in `eu-west-1a`, Orders Database is single-AZ, and there is no durable asynchronous buffer. The missing WAF and secrets manager create meaningful security findings.

## Human authority handoff

1. In **Architecture Constraints**, set maximum monthly cost to **3000** and target resilience to **90**.
2. Select **Orders Database** and click **Lock component**.
3. Keep WebMCP in Review Mode and ask ChatGPT: “Analyze this architecture for production readiness. Do not modify anything.”
4. Open Activity to show the agent-attributed analysis.
5. Click **Enable editing**. This captures the current, human-constrained Architecture IR as the comparison baseline and registers exactly five edit tools in addition to the four read tools.

The locked PostgreSQL component remains a human decision. Asking the agent to update or remove it returns `COMPONENT_LOCKED` and adds a visibly blocked activity entry without mutation.

## Target transformation

Ask ChatGPT:

> Improve the architecture to survive an availability-zone failure while staying under my budget. Keep PostgreSQL.

The tested target transformation:

- distributes Storefront API replicas across `eu-west-1a` and `eu-west-1b`;
- adds a WAF between the CDN and load balancer;
- adds an encrypted durable queue;
- adds a secrets manager;
- preserves the locked single-AZ Orders Database;
- adds an independent PostgreSQL failover replica in `eu-west-1b` with an encrypted replication connection.

Under the simplified deterministic model, the target state is:

| Metric                      | Before |  After | Delta |
| --------------------------- | -----: | -----: | ----: |
| Estimated architecture cost |   $675 | $1,288 | +$613 |
| Resilience                  |     57 |    100 |   +43 |
| Security                    |     76 |     90 |   +14 |

The target stays below the $3,000 budget and exceeds the resilience target. Disable Agent Editing to remove all five mutation tools and automatically open the deterministic Architecture IR comparison. Added, changed, and removed columns are computed by stable IDs rather than activity prose.

## Failure proof

Ask ChatGPT or use the Simulation panel:

> Simulate the loss of eu-west-1a.

The target architecture reports **System remains degraded**. The primary database and ECS service show degraded capacity, the independent database replica survives, impacted edges are explicitly labeled, and every modeled critical component remains reachable. The simulation does not mutate Architecture IR, persistence, or undo history.

## Repeat

Click **Reset Demo**. It restores the five-node Ecommerce template and clears activity, undo/redo history, the active simulation, selection, Agent Edit authorization, and the temporary comparison checkpoint. WebMCP read tools remain available when the browser supports them.
