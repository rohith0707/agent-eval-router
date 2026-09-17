# Loop Engineer — Interview Guide

Use this document to explain the system without overselling it.

## 30-second explanation

Loop Engineer is a bounded autonomous software-engineering system. Specialized stages investigate a task, execute work, test the result, review it, repair failures and verify completion. A control plane sits around the workflow and decides whether work is allowed, how much it may cost, when it may retry or repair, and when it must stop.

## Core design decisions

### Why deterministic policy?
Policy is a hard boundary, not a probabilistic suggestion. An LLM can propose an action, but the runtime owns authorization and stopping decisions.

### Why evidence instead of model confidence?
Confidence is a model-produced signal. Evidence is an observable execution artifact. Completion should depend on explicit checks, not the model saying that it succeeded.

### Retry vs repair
Retry means the execution mechanism failed or a transient provider failure occurred. Repair means verification found a substantive defect and the task needs another bounded engineering iteration.

### Why bounded autonomy?
Autonomous loops can amplify cost, latency and mistakes. Every run therefore has hard limits for cost, iterations, wall time and failures.

### Why keep routing?
Routing is a mechanism inside the control plane, not the product category. Historical evidence can influence provider/model selection, while hard policy constraints remain higher priority.

### What is not claimed yet?
The current prototype does not claim production-scale multi-tenancy, a fully independent verifier, measured superiority over every baseline, or unrestricted secure code execution. Those require additional implementation and benchmark evidence.

## Questions to practice

1. What happens when verification fails?
2. What prevents a runaway agent loop?
3. How do you distinguish retry from repair?
4. How would you defend against prompt injection through tool output?
5. What metrics would prove the control plane improves outcomes?
6. How would you evolve SQLite to a production persistence layer?
7. How would you implement circuit breakers and idempotency?
8. What evidence is stored for each decision?
9. What would make historical routing evidence stale?
10. What would you change before allowing write-capable production tools?

## Evidence-first interview rule

Never invent benchmark numbers. If a result is simulated, say `SIMULATED_DEMO`. If it comes from a real provider run, say `MEASURED_PROVIDER_RUN` and show the run evidence.
