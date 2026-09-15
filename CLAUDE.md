# CLAUDE.md — Evidence-Driven Agent Control Plane Coding Contract

## Project identity

This repository is evolving from **Agent Eval Router** into an **Evidence-Driven Agent Control Plane**.

The router is a capability inside the control plane. Do not reposition the repository as a generic LLM router or generic multi-agent framework.

## Product statement

> **The control plane for autonomous AI work: decide, constrain, verify, and explain what agents do.**

The product's core primitive is the **Decision + Evidence Ledger**.

`Intent → Policy → Evidence → Decision → Action → Verification → Evidence → Next Decision`

## Strategic boundary

The market already contains multi-agent orchestration and swarm frameworks. Do not build another one unless the PRD is explicitly expanded.

Specialized agents/workers may exist inside one bounded workflow, but "many agents collaborating" is not our product moat. The product value is runtime control, verification, accountability, economics, and evidence-backed decisions.

## Architecture

```text
Agent Intent
    ↓
Task / Action Analysis
    ↓
Policy + Risk + Autonomy + Hard Limits
    ↓
Evidence Retrieval
    ↓
Strategy / Candidate Generation
    ↓
Decision
 ┌────────┬────────┬────────┬──────────┬──────────┬────────┐
 ALLOW   ROUTE    RETRY    FALLBACK   ESCALATE   BLOCK
 └────────┴────────┴────────┴──────────┴──────────┴────────┘
    ↓
Guarded Real Execution
    ↓
Verification / Evaluation
    ↓
Decision Ledger + Evidence
    ↓
Loop Controller
 ┌──────────┬────────┬────────┬──────────┬────────┐
 COMPLETE  REPAIR  REPLAN  ESCALATE   ABORT
 └──────────┴────────┴────────┴──────────┴────────┘
    ↓
Next bounded decision
```

## Core engineering objective

Build one complete, real, inspectable vertical slice before broadening:

`policy → decision → real action → verification → ledger → bounded next decision`

The first spectacular proof should be a coding/CI workflow that can demonstrate:

`FAIL → REPAIR → VERIFY → COMPLETE`

## Repository-first behavior

Before editing:

- inspect the current agent entrypoint;
- inspect Python nodes/state/graph;
- inspect provider adapters;
- inspect history/evidence persistence;
- inspect trajectory/event schemas;
- inspect API contracts;
- inspect frontend decision views;
- inspect tests and CI.

Reuse existing abstractions. Do not create parallel routing, provider, history, or evaluation implementations without proving the existing abstraction cannot support the requirement.

## Decision engine rules

1. Authorization and hard safety constraints are evaluated first.
2. Risk determines required autonomy.
3. Run limits constrain execution before another action starts.
4. Policy eligibility precedes optimization.
5. Historical evidence influences only eligible candidates.
6. A quality score can never override a hard policy block.
7. Every meaningful decision gets a stable ID and is recorded before execution.
8. Execution outcome links back to the decision ID.
9. Only evaluated/verified outcomes become future routing evidence.
10. Completion is determined by verification evidence, not an agent's self-reported success.

## Runtime decisions

Use these semantic action decisions:

`ALLOW | ROUTE | RETRY | FALLBACK | ESCALATE | BLOCK`

Use these bounded loop outcomes:

`COMPLETE | REPAIR | REPLAN | ESCALATE | ABORT`

## Hard autonomy limits

Every autonomous run must have server-side enforcement for:

- maximum cost;
- maximum iterations;
- maximum wall-clock time;
- maximum consecutive failures;
- explicit pause/kill state where implemented.

A UI warning is not a safety control. The server must refuse further execution after a hard limit is reached.

## Decision Ledger minimum

A decision must be explainable using:

- decision_id;
- run_id;
- agent_id when available;
- action/task type;
- risk class;
- autonomy level;
- policy version;
- constraints and hard-limit state;
- candidate strategies;
- selected strategy;
- rejection/selection reason codes;
- evidence IDs and snapshot metadata;
- estimated cost;
- actual model/tool;
- outcome;
- verification result;
- timestamp.

Do not persist or expose private chain-of-thought.

## Model routing

The existing evidence-aware model router remains a capability.

It should answer:

> Among policy-eligible strategies, which one has the strongest evidence-backed tradeoff for this task and its constraints?

Do not hard-code a universal winner. Do not make provider marketing claims. Do not report fixtures as measured results.

## Execution

Production behavior must:

- use real adapters;
- enforce bounded timeouts;
- classify failures;
- capture actual latency and usage/cost where available;
- normalize responses;
- link execution to run/decision IDs;
- keep credentials outside source and logs.

Fixtures/mocks are allowed in tests but must be explicitly labeled.

## Tool runtime

Every real tool must have:

- explicit name/version;
- typed/schema-validated input;
- server-side policy authorization;
- timeout;
- payload bound;
- bounded retry;
- idempotency strategy where relevant;
- sanitized output metadata;
- typed failure class;
- ledger/trajectory events.

Prefer read-only or sandboxed tools for demonstrations.

## Reliability

Retry/fallback is allowed only for classified retryable failures and only within limits.

Do not retry authorization, permission, validation, or policy failures as transient errors.

Circuit-breaker state should be scoped to the failing provider/model/tool.

## Verification and repair

Verification is independent enough to challenge the work that preceded it.

For an engineering workflow:

```text
Investigation
 → Implementation
 → Independent tests/checks
 → Review
 → COMPLETE or REPAIR
```

A repair iteration must point to concrete failure evidence. Never create extra agents merely to make the system appear autonomous.

## Counterfactual replay

When implemented, replay must freeze the original intent and evidence snapshot and recompute a decision under an alternative policy/configuration.

Replay is simulation by default and must not execute dangerous external actions.

Expose:

- actual decision;
- counterfactual decision;
- strategy/model/tool difference;
- estimated cost/latency difference;
- policy difference;
- benchmark-backed expected quality where available.

## Evaluation

Evaluation must be empirical for real execution claims.

Useful dimensions:

- task success;
- verification status;
- final quality;
- tool correctness;
- latency;
- cost;
- failure class;
- policy compliance;
- repair/fallback behavior.

Never use a constant quality such as `0.85` in the real execution path.

## Security

Never log or persist:

- API keys;
- bearer tokens;
- cookies;
- authorization headers;
- secrets;
- unnecessary sensitive payloads.

High-risk actions fail closed if authorization or policy state is unavailable.

## Observability

Every important transition must be attributable to `run_id`; every decision to `decision_id`.

Recommended events:

`RUN_STARTED`, `INTENT_ANALYZED`, `POLICY_EVALUATED`, `EVIDENCE_RETRIEVED`, `CANDIDATES_SCORED`, `DECISION_MADE`, `MODEL_STARTED`, `MODEL_COMPLETED`, `TOOL_AUTHORIZED`, `TOOL_STARTED`, `TOOL_COMPLETED`, `VERIFICATION_STARTED`, `VERIFICATION_COMPLETED`, `REPAIR_STARTED`, `RETRY_STARTED`, `FALLBACK_STARTED`, `ESCALATION_REQUIRED`, `ACTION_BLOCKED`, `EVIDENCE_RECORDED`, `RUN_COMPLETED`, `RUN_ABORTED`.

## UI contract

Keep navigation focused:

- **RUN:** task, current loop iteration, decision, risk, budget, action, verification, and outcome.
- **DECISIONS:** Decision Ledger with a prominent **Why?** inspection.
- **SETTINGS:** policies, models, tools, budgets, and runtime limits.

Do not create subsystem dashboards merely because a backend subsystem exists.

The CEO/CTO demo should be understandable in roughly 60 seconds:

`TASK → DECISION → EVIDENCE → ACTION → VERIFICATION → COMPLETE/REPAIR/ESCALATE`

## Coding style

- Keep functions small and domain-oriented.
- Prefer typed contracts and explicit enums.
- Avoid unnecessary abstractions.
- Preserve compatible APIs where practical.
- Add tests beside new behavior.
- Keep network calls out of pure scoring/policy functions.
- Make side effects explicit.
- Keep provider-specific logic in adapters.
- Prefer deterministic policy evaluation.

## Test expectations

Every new decision capability should cover, where applicable:

1. happy path;
2. policy rejection;
3. budget violation;
4. runtime-limit stop;
5. timeout/failure path;
6. evidence persistence;
7. decision explanation fields;
8. verification result;
9. repair/recovery behavior.

The primary integration proof should eventually demonstrate:

```text
first execution
 → verification
 → evidence persisted
 → bounded second decision
 → evidence affects strategy
```

## Documentation contract

Use explicit provenance labels:

- `MEASURED`
- `SYNTHETIC`
- `FIXTURE`
- `TARGET`
- `DESIGN`

Never turn an architectural target into a claimed result.

## Scope guard

Do not introduce without explicit PRD expansion:

- generic multi-agent swarm orchestration;
- agent marketplace;
- dozens of providers/tools;
- full enterprise IAM;
- Kubernetes platform;
- generic RAG;
- autonomous policy self-modification;
- RL routing;
- large BI suite;
- autonomous destructive actions.

## Final implementation check

Before declaring work complete:

- Is the behavior in the real runtime path?
- Is the decision explicit and inspectable?
- Can the user see why it happened?
- Is verification independent and measurable?
- Are evidence provenance and timestamps clear?
- Are cost/time/iteration/failure limits enforced server-side?
- Are failure modes bounded?
- Are secrets protected?
- Are tests/typecheck/build passing?
- Does documentation match the code?
