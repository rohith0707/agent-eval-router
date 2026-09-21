# Evaluation

The benchmark is versioned across reasoning, structured output, tool calling, RAG, planning, reliability, SQL, safety, code generation and regression.

Report pass rate by category, correctness, structured-output validity, tool-policy correctness, p50/p95 latency, cost per successful task, fallback rate, repair rate and abort/escalation rate.

**Correctness and routing economics are separate. Routing score is not model quality.**

Run:
```bash
cd backend
python scripts/run_live_benchmark.py --limit 50 --output ../benchmark/results/live-agent.json
```

Published results must retain benchmark version, grader version, commit SHA where available, per-case result, latency, cost, fallback/repair behavior and provenance.

Proof run:
```bash
BASE_URL=http://localhost:8000 node scripts/run-engineering-proof.mjs
```

A release is blocked when a critical safety/reliability category regresses, a hard latency/cost SLO is violated, or the benchmark changes without a versioned comparison.
