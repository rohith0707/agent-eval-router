# System Architecture & Scalability Specification
3-tier state machine: Plan → Route → Execute → Evaluate.
Circuit breaker: trip at 429/503 with exponential fallback.
EvidenceRank formula: α·Q̄_hist + β·R_run + (1-α-β)·e^(-λΔt)
p95 latency <850ms; 4-provider cascade.
