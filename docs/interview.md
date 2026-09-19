# Interview case study

## Five-minute explanation

Agent Eval Router is a control plane for autonomous AI work. The system does not assume that an agent should always act. Before execution it evaluates policy, risk, evidence, and budget, selects an allowed route, executes within server-side limits, verifies the result, and records the decision.

## Why not a swarm?

A swarm optimizes collaboration; this product optimizes controlled autonomy. More agents increase latency, cost, and attribution complexity. Specialized worker roles are therefore bounded by one control plane.

## Why deterministic verification?

The current verifier is deliberately deterministic where possible. That makes the completion gate reproducible and auditable. It should not be described as an independent LLM judge. An LLM judge can be added later as a separately measured signal, never as the only safety gate.

## Why SQLite?

SQLite keeps the portfolio runtime reproducible and simple. The ledger interface is designed to be replaceable by PostgreSQL plus a durable queue when concurrency and multi-instance execution require it.

## What happens when the model fails?

The runtime records the failure, may use a bounded fallback, and can enter a bounded repair loop. Cost, iteration, failure, and wall-time limits remain enforced throughout.

## What would change at 1M runs/day?

Separate API and workers, PostgreSQL for durable state, a queue for execution, distributed tracing, idempotency keys, per-tenant policy, centralized secrets, autoscaling, and SLO-driven alerting.
