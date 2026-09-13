# Agent Instructions — Evidence-Driven Agent Decision Engine

You are an implementation agent working on this repository. Your job is to evolve the existing Agent Eval Router into an **Evidence-Driven Agent Decision Engine** without rewriting the system unnecessarily.

## Mission

Build the smallest credible production-style runtime decision loop:

`Intent → Policy → Evidence → Decision → Real Execution → Evaluation → Evidence`

The product is not another chatbot, agent framework, generic observability dashboard, or model gateway.

## Non-negotiable rules

1. **Reuse before rewrite.** Inspect existing routing, provider adapters, history/evidence, trajectory, evaluation, API and UI before adding abstractions.
2. **Real execution beats simulation.** Do not expand fake execution. Replace mocks with one real model integration and one real bounded tool first.
3. **Never fake measurements.** Do not hard-code quality, latency, cost, or success and present them as production measurements.
4. **Separate provenance.** Label data as `MEASURED`, `SYNTHETIC`, `FIXTURE`, `TARGET`, or `DESIGN`.
5. **Policy beats score.** A high model score cannot override a hard safety, permission, budget, or authorization rule.
6. **Fail closed for high-risk actions.** Missing authorization/policy must not silently permit dangerous execution.
7. **Bound autonomy.** Every retry, tool call, model call, and workflow step needs explicit limits.
8. **Explain decisions, not hidden chain-of-thought.** Persist structured reasons, policy matches, scores, constraints, and evidence IDs; never request or expose private chain-of-thought.
9. **Keep contracts typed.** Prefer Pydantic/domain models and explicit enums over unstructured dictionaries when practical.
10. **Tests are part of implementation.** Every new decision path requires unit tests; critical paths require integration tests.

## Required decision enum

Use exactly these semantic outcomes unless the existing code has a compatible enum:

- `ALLOW`
- `ROUTE`
- `RETRY`
- `FALLBACK`
- `ESCALATE`
- `BLOCK`

## Decision inputs

The decision engine should consider, where available:

- task/action type
- agent identity
- requested model/tool
- model/tool capability
- applicable policy
- risk class
- autonomy level
- quality floor
- latency budget
- cost budget
- historical evidence
- current provider/tool health
- previous failures in the run

## Decision order

Implement the conceptual order:

`authorization → hard policy → risk → tool permission → budget → quality/latency constraints → evidence → candidate scoring → autonomy decision`

Hard constraints must be evaluated before optimization scoring.

## Engineering workflow

Before changing code:

1. Inspect repository structure.
2. Find the current agent entry point and execution node.
3. Find existing provider/model adapters.
4. Find history/evidence persistence.
5. Find trajectory/event schemas.
6. Find current tests.
7. Identify the smallest insertion point for policy + decision.
8. Implement one vertical slice.
9. Run tests/type checks/lint/build as applicable.
10. Update documentation only after the implementation is truthful.

## Preferred vertical slice

Start with one scenario:

```text
Agent requests tool/action
  ↓
Policy evaluator
  ↓
Decision = ALLOW / ESCALATE / BLOCK
  ↓
If allowed: execute real bounded tool
  ↓
Evaluate result
  ↓
Persist evidence
```

Then connect the existing model router as a `ROUTE` decision capability.

## Real model requirements

When replacing mock execution:

- use an existing provider abstraction if present;
- keep credentials in environment/config, never source code;
- set timeout;
- classify failures;
- capture usage/cost when the provider exposes it;
- record latency from the actual request;
- normalize the response;
- persist the model/provider in trajectory;
- ensure tests can run without live credentials through a clearly marked fixture/mock adapter.

## Real tool requirements

Select one tool with a safe, bounded API. The adapter must have:

- explicit input schema;
- authorization/policy check;
- timeout;
- input size bounds;
- bounded retry;
- idempotency where relevant;
- sanitized result;
- failure classification;
- trajectory event.

Do not integrate a dangerous destructive tool just to demonstrate the feature. A read-only or sandboxed tool is preferred for the first real integration.

## Evidence requirements

A historical record is useful only when its provenance is clear. Evidence aggregation should consider:

- sample size;
- task similarity;
- recency/freshness;
- success/quality;
- latency;
- cost;
- failure modes.

Do not let a single synthetic or anomalous record determine a routing decision.

## UI rules

Keep the primary navigation:

`RUN | DECISIONS | SETTINGS`

The main UI should answer:

> Why did the agent make this decision?

For each decision show:

- requested action;
- decision;
- policy matched;
- risk;
- candidate strategies;
- evidence used;
- selected model/tool;
- cost and latency;
- outcome;
- failure/fallback if any.

Do not add separate top-level pages for every subsystem unless a real user workflow requires them.

## Documentation truthfulness

Use these labels whenever describing metrics:

- **Measured:** generated by reproducible real execution.
- **Synthetic:** generated by a simulation.
- **Fixture:** static test/demo data.
- **Target:** desired SLO or future goal.
- **Design:** architectural intention, not measured behavior.

Never write a target p95, cost saving, success rate, or benchmark result as though it were already measured.

## What not to do

Do not:

- rewrite the entire backend;
- introduce multi-agent swarm orchestration;
- add dozens of providers;
- add dozens of tools;
- build generic RAG;
- build full enterprise IAM;
- add RL/self-modifying policies;
- optimize UI before the real runtime loop works;
- invent benchmark numbers;
- add dependencies without a concrete need;
- expose private model reasoning.

## Definition of done for each implementation slice

A slice is done only when:

1. The behavior is implemented in the runtime path.
2. There is a typed contract.
3. The failure path is bounded.
4. The decision is observable.
5. Evidence provenance is clear.
6. Tests cover success and failure.
7. Documentation matches the implementation.
8. Existing behavior remains compatible unless intentionally changed.
