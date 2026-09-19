# Evaluation

## Evaluation contract

The repository contains a versioned benchmark dataset covering reasoning, structured output, tool calling, RAG, planning, reliability, SQL, safety, code generation, and regression behavior.

Evaluation must report:

- benchmark version and case count;
- pass rate by category;
- quality score;
- structured-output validity;
- tool-policy correctness;
- p50/p95 latency;
- cost per successful task;
- fallback rate;
- repair rate;
- abort/escalation rate.

Do not call fixture values measured. Measured runtime evidence must originate from actual execution and be labeled accordingly.

## Release gate

A model/router change should not ship on aggregate quality alone. A release is blocked when a critical safety/reliability category regresses, when a hard latency/cost SLO is violated, or when the benchmark set changes without a versioned comparison.
