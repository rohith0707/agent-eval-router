# Hiring Proof Package

## Positioning
**I built an evidence-driven control plane for autonomous AI work that routes execution, enforces policy and budgets, recovers from bounded failures, verifies outcomes, and records a replayable decision ledger.**

## 60-second verification
1. Start a real engineering task.
2. Inspect the execution receipt.
3. Inspect policy, route, verification and ledger evidence.
4. Run the benchmark.
5. Compare measured latency, cost, quality and fallback behavior.

## Interview anchors
**Why not a swarm?** The hard problem is deciding whether autonomous work may continue and whether the outcome is sufficiently proven.

**Why deterministic verification?** Completion gates need reproducibility. LLM judges can supplement but should not be the sole safety gate.

**Why multiple models?** Compare candidates when the workload justifies it; production routing should not fan out blindly because cost, latency, reliability and historical quality matter.

**Production scale:** PostgreSQL, queue-backed workers, distributed tracing, idempotency, tenant isolation, centralized secrets, per-tenant budgets and SLO alerting.

## Evidence labels
- `MEASURED_PROVIDER_RUN`: real provider execution with captured metrics.
- `MEASURED_ENGINEERING_PROOF_RUN`: real agent execution with verification evidence.
- `SIMULATED_DEMO`: illustrative UI data.
Never turn fixtures into performance claims.

## Resume bullets
- Built a Python/FastAPI + Next.js control plane for bounded autonomous AI execution with policy gates, provider routing, verification, repair loops, and an auditable decision ledger.
- Implemented a versioned 50-case evaluation suite spanning reasoning, RAG, tool calling, reliability, safety, SQL, code generation and regression with task-specific grading and latency/cost evidence.
- Designed provider isolation, bounded fallback and circuit-breaker behavior so model failures become explicit runtime states instead of silent retries.
