# Hiring Proof Package

## Positioning
I built an evidence-driven control plane for autonomous AI work that routes execution, enforces policy and budgets, recovers from bounded failures, verifies outcomes, and records a replayable decision ledger.

## 60-second proof
Start a real engineering task, inspect the execution receipt, inspect policy/route/verification/ledger evidence, run the benchmark path, then compare measured latency, cost, quality and fallback behavior.

## Engineering claims
- Controlled autonomy: an LLM response is not equivalent to task completion.
- Explicit evaluation: correctness is separate from routing economics.
- Observable failure: provider attempts, fallback, repair, verification and decision reasons are inspectable.

## Interview answers
**Why not a swarm?** Collaboration is not the product problem; controlled autonomous execution is.
**Why deterministic verification?** Completion needs reproducibility. LLM judges can be an additional measured signal, not the only safety gate.
**Why route multiple models?** To compare candidates when the workload justifies it; production routing should not fan out blindly.
**What changes at production scale?** PostgreSQL, queue-backed workers, distributed tracing, idempotency, tenant isolation, centralized secrets, budgets and SLO alerting.

## Evidence language
MEASURED_PROVIDER_RUN = real provider execution.
MEASURED_ENGINEERING_PROOF_RUN = real agent execution with verification evidence.
SIMULATED_DEMO = illustrative UI data.
Never turn fixtures or expected behavior into performance claims.

## Resume bullets
- Built a Python/FastAPI + Next.js control plane for bounded autonomous AI execution with policy gates, provider routing, verification, repair loops, and a durable decision ledger.
- Implemented a versioned 50-case evaluation suite spanning reasoning, RAG, tool calling, reliability, safety, SQL, code generation and regression with task-specific grading and latency/cost evidence.
- Designed provider isolation, bounded fallback and auditable execution receipts so model failures become explicit runtime states instead of silent retries.
