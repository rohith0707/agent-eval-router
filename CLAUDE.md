# CLAUDE.md — Agent Decision Engine Coding Contract

## Project identity

This repository is evolving from **Agent Eval Router** into an **Evidence-Driven Agent Decision Engine**.

Do not treat the project as a generic LLM router. The router is one capability inside a runtime decision layer for production AI agents.

## Product statement

> Decide what an AI agent should do next — which model or tool to use, how much it can spend, whether approval is required, and when it should stop — using policy plus historical execution evidence.

## Architecture

```text
Agent Intent
    ↓
Intent / Task Analysis
    ↓
Policy + Risk + Budget
    ↓
Evidence Retrieval
    ↓
Candidate Generation / Existing Router
    ↓
Decision
 ┌────────┬────────┬────────┬──────────┬──────────┬────────┐
 ALLOW   ROUTE    RETRY    FALLBACK   ESCALATE   BLOCK
 └────────┴────────┴────────┴──────────┴──────────┴────────┘
    ↓
Guarded Real Execution
    ↓
Evaluation
    ↓
Evidence Store
    └──────────────→ Future Decisions
```

## Core engineering objective

Make one complete vertical slice real before broadening scope:

`policy → decision → real execution → evaluation → evidence → next decision`

## Repository-first behavior

Before editing:

- inspect the existing agent entrypoint;
- inspect existing Python nodes/state/graph code;
- inspect provider adapters;
- inspect history/evidence code;
- inspect trajectory schemas;
- inspect API contracts;
- inspect frontend decision views;
- inspect tests and CI.

Reuse compatible abstractions. Do not create parallel implementations of routing, history, or provider adapters without first proving the existing abstraction cannot support the requirement.

## Decision engine rules

1. Authorization and hard safety rules are evaluated first.
2. Risk determines required autonomy.
3. Budget and latency constraints constrain candidate selection.
4. Historical evidence influences optimization only among eligible candidates.
5. A model quality score cannot override a hard policy block.
6. Every decision receives a stable ID and is recorded before execution.
7. Execution outcome is linked to the decision ID.
8. Only evaluated outcomes become routing evidence.

## Decision values

Prefer the following domain enum:

`ALLOW | ROUTE | RETRY | FALLBACK | ESCALATE | BLOCK`

## Data model minimum

Every decision should be explainable using:

- decision_id
- run_id
- agent_id when available
- action_type
- risk_class
- autonomy_level
- policy_version
- candidate strategies
- selected strategy
- reason codes
- evidence IDs
- estimated cost
- constraints
- timestamp

Every evidence record should be traceable to an actual execution or an explicitly labeled fixture/benchmark.

## Model routing

The current evidence-aware model router remains important. It should answer:

> Among the models that satisfy policy and task constraints, which strategy has the best evidence-backed tradeoff?

Do not hard-code a model winner globally.

Do not make provider marketing claims.

Do not report synthetic benchmark data as measured production data.

## Execution

The previous execution path may contain mocks/simulations. When implementing production behavior:

- remove mock values from the real path;
- use a real adapter behind the existing provider abstraction;
- enforce timeouts;
- classify failures;
- capture actual latency and usage/cost when available;
- keep credentials out of source and logs.

A fixture/mock adapter is acceptable in tests, but it must be obvious that it is a fixture.

## Tool runtime

The first real tool should be bounded and preferably read-only or sandboxed.

Required controls:

- input schema validation;
- permission/policy evaluation;
- timeout;
- payload bounds;
- bounded retries;
- idempotency where appropriate;
- sanitized outputs;
- typed failure class;
- trajectory event.

## Reliability

Transient failures can lead to `RETRY` or `FALLBACK` only when policy allows.

Use circuit-breaker state scoped to the failing provider/model/tool. Do not retry authorization, validation, or policy failures as though they were transient infrastructure failures.

## Evaluation

Evaluation must be empirical on real benchmark executions where claims are made.

Recommended benchmark dimensions:

- final answer quality;
- task success;
- tool correctness;
- latency;
- cost;
- failure class;
- policy compliance;
- fallback behavior.

Do not use a constant quality value such as `0.85` in the production execution path.

## Security

Never log or persist:

- API keys;
- bearer tokens;
- cookies;
- authorization headers;
- secrets;
- unnecessary sensitive payloads.

High-risk actions fail closed if authorization or policy state is unavailable.

Replay is non-destructive by default.

## Observability

Every important runtime transition should be attributable to `run_id`, and decisions to `decision_id`.

Useful event names:

`RUN_STARTED`, `INTENT_ANALYZED`, `POLICY_EVALUATED`, `EVIDENCE_RETRIEVED`, `CANDIDATES_SCORED`, `DECISION_MADE`, `MODEL_STARTED`, `MODEL_COMPLETED`, `TOOL_AUTHORIZED`, `TOOL_STARTED`, `TOOL_COMPLETED`, `RETRY_STARTED`, `FALLBACK_STARTED`, `ESCALATION_REQUIRED`, `ACTION_BLOCKED`, `EVALUATION_COMPLETED`, `EVIDENCE_RECORDED`, `RUN_COMPLETED`.

## UI

Keep the product surface focused:

- **RUN:** execute a task and observe the decision/runtime loop.
- **DECISIONS:** explain why an action/model/tool was selected, changed, escalated, or blocked.
- **SETTINGS:** policies, models, tools, budgets.

The key interaction is **Why?** — users should be able to inspect the evidence and policy behind a decision.

## Replay

When implemented, replay must freeze the original input/evidence snapshot and evaluate an alternative policy/configuration without executing dangerous external actions.

Show counterfactual differences such as:

- decision;
- model/tool;
- estimated cost;
- estimated latency;
- policy outcome;
- benchmark-backed expected quality where available.

## Coding style

- Keep functions small and domain-oriented.
- Prefer typed contracts.
- Avoid unnecessary abstractions.
- Preserve backwards compatibility where practical.
- Add tests beside new behavior.
- Keep network calls out of pure scoring functions.
- Make side effects explicit.
- Prefer deterministic policy evaluation.
- Keep provider-specific logic inside adapters.

## Test expectations

For every new decision capability test at least:

1. happy path;
2. policy rejection;
3. budget violation;
4. timeout/failure path where applicable;
5. evidence persistence;
6. decision explanation fields.

The primary integration test should eventually prove:

```text
first execution
 → evaluated outcome
 → evidence persisted
 → second similar execution
 → evidence affects candidate decision
```

## Documentation contract

Use explicit provenance labels:

- `MEASURED`
- `SYNTHETIC`
- `FIXTURE`
- `TARGET`
- `DESIGN`

Never turn architectural targets into claimed results.

## Scope guard

Do not introduce these unless the product requirements are explicitly expanded:

- multi-agent swarm orchestration;
- full enterprise IAM;
- Kubernetes control plane;
- dozens of providers/tools;
- generic RAG platform;
- autonomous policy self-modification;
- reinforcement-learning router;
- large analytics suite.

## Final implementation check

Before declaring a task complete, answer:

- Is the behavior in the real runtime path?
- Can a user see the decision and why it happened?
- Is the outcome measurable?
- Is the evidence provenance clear?
- Are failure modes bounded?
- Are secrets protected?
- Are tests passing?
- Does documentation match the code?
