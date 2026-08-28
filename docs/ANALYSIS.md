# Deterministic architecture intelligence

AetherSketch analyzes its provider-neutral Architecture IR with explicit TypeScript rules. The engines do not call an LLM, cloud API, pricing API, or external service. Identical architecture input produces identical output.

## Combined analysis

`analyzeArchitecture(architecture, options?)` returns:

- structural validation status and findings;
- **Estimated architecture cost** in USD per month;
- resilience and security scores from 0 to 100;
- evaluation of every human-authored architecture constraint;
- a severity-sorted, de-duplicated finding list.

The optional `focus` value (`all`, `validation`, `cost`, `resilience`, or `security`) filters only the combined finding list. Every engine still runs, so all metrics and constraint results remain available.

Each finding includes a stable ID, rule code, category, severity, optional component or edge reference, explanation, remediation, evidence, and a `deterministic: true` marker.

## Validation rules

Validation detects:

- duplicate component and connection IDs;
- dangling sources and targets;
- self-connections;
- public ingress connected directly to a data service;
- isolated or entry-unreachable critical components;
- an architecture with no entry path;
- data or integration dependencies with no compute runtime.

This analysis can inspect an unsafe in-memory graph even when the stricter serialization and store boundaries would reject it.

## Estimated architecture cost

The cost model starts with each component kind's catalog baseline. It then applies only visible configuration multipliers:

- virtual machines: known instance-size factor and replica count;
- container services: CPU/memory task-size factor and replica count;
- serverless functions: memory factor with a 0.5 minimum;
- SQL databases: size tier, 1.6× Multi-AZ factor, and storage above 100 GB;
- NoSQL databases: 2× for global tables;
- caches: replica count and 1.5× cluster mode;
- CDN: 1.35× for the global price class;
- queues: 1.15× for FIFO;
- object storage: 1.1× for versioning.

Component and total values are rounded to cents. Request volume, data transfer, regional pricing, discounts, taxes, support, reserved capacity, and provider price-sheet details are intentionally excluded.

**The result is a planning estimate, not an AWS billing quote.**

## Resilience score

Resilience begins at 90 and applies these deterministic adjustments:

| Rule                                            | Adjustment |
| ----------------------------------------------- | ---------: |
| Critical SQL database is single-AZ              |        -12 |
| Critical SQL database is Multi-AZ               |         +4 |
| Critical SQL database has a cross-AZ replica    |         +4 |
| Database backups disabled                       |         -7 |
| Critical provisioned compute is single-AZ       |         -8 |
| Critical provisioned compute has one replica    |         -7 |
| Critical compute has replicas across zones      |         +5 |
| Multiple compute replicas have no load balancer |         -6 |
| Event processing has no durable queue           |         -8 |
| Queue buffering is present                      |         +2 |
| Critical path contains non-redundant components |         -6 |
| Every critical component is redundant           |         +3 |

The final value is rounded and clamped to 0–100. A SQL database is redundant when it either models native Multi-AZ capacity or has a same-kind peer connected by a `replication` edge with capacity in another availability zone. The initial Ecommerce template scores **57**. The canonical locked-database demo adds two-zone ECS capacity, an independent PostgreSQL replica, and durable buffering; it scores **100**, satisfying the 90+ target without altering the locked primary database.

The score evaluates modeled structure only. It is not an availability forecast, SLA, recovery-time calculation, or substitute for load and failover testing.

## Security score

Security begins at 82 and applies these deterministic adjustments:

| Rule                                           | Adjustment |
| ---------------------------------------------- | ---------: |
| Public SQL database                            |        -25 |
| Unencrypted database                           |        -20 |
| Other unencrypted data service                 |        -12 |
| Public object storage                          |        -15 |
| Secret-like key/value in component metadata    |        -15 |
| Unencrypted data connection                    |        -12 |
| Public web path without WAF                    |         -6 |
| WAF present                                    |         +3 |
| Compute and data exist without secrets manager |         -5 |
| All applicable services encrypted at rest      |         +3 |
| All data connections encrypted in transit      |         +2 |

The final value is rounded and clamped to 0–100. The initial Ecommerce template scores **76**. Adding a WAF and secrets manager to the tested hardened variant raises it to **90**.

The score is architecture feedback, not a vulnerability scan, threat model, compliance decision, or penetration test.

## Constraint evaluation

The analyzer reports `met`, `not-met`, or `not-applicable` for:

- maximum monthly cost;
- target resilience score;
- target security score;
- required region;
- required Multi-AZ redundancy for critical zonal components;
- required encryption at rest for applicable components.

`withinBudget` is `null` when no budget is set. `allApplicableConstraintsMet` ignores not-applicable constraints and is false if any applicable constraint fails.

## Failure simulation

`simulateFailure` supports three scopes:

- `component`: removes one component;
- `availability-zone`: fails single-zone capacity and degrades components with modeled surviving capacity in another zone;
- `region`: fails regional components while retaining explicitly global component kinds.

For availability-zone simulations, a component also retains degraded service when a same-kind replication peer connected through a `replication` edge survives outside the failed zone. This lets the canonical demo preserve the locked PostgreSQL primary while explicitly modeling separate failover capacity.

The result identifies failed and degraded components, impacted edges, surviving components, critical-path reachability, overall status, explanation, and structured findings. Simulation never mutates architecture state.

The graph model does not simulate traffic volume, latency, dependency timeouts, capacity exhaustion, health-check timing, data loss, cross-region failover, recovery duration, or cascading behavior beyond reachability. It is deterministic design feedback, not a production incident forecast.

## Transient result lifecycle

Analysis and simulation results live in `useIntelligenceStore`, not in persisted project state. A run records the Architecture revision used. An Architecture change marks analysis stale and clears the prior simulation; users or tools must explicitly rerun analysis. Intelligence operations never create undo history. When WebMCP initiates a successful analysis or simulation, the adapter separately appends an agent activity entry so the shared UI reflects the action in near real time.
