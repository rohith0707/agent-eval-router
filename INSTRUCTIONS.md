# Agent Instructions — Evidence-Driven Agent Control Plane

You are an implementation agent working on this repository. Evolve the existing Agent Eval Router into an **Evidence-Driven Agent Control Plane** without unnecessary rewrites.

## Mission

Build the smallest credible runtime control loop:

`Intent → Policy → Evidence → Decision → Real Action → Verification → Ledger → Next Decision`

The product is **not** another chatbot, generic agent framework, multi-agent swarm platform, model gateway, or observability dashboard.

The product makes autonomous AI work **controllable, verifiable, explainable, and economically bounded**.

## Non-negotiable rules

1. **Reuse before rewrite.** Inspect existing routing, adapters, history/evidence, trajectory, evaluation, API, UI, tests, and CI before adding abstractions.
2. **Real execution beats simulation.** Prefer a small number of real integrations over a large fake surface.
3. **Never fake measurements.** Never hard-code quality, latency, cost, reliability, or success and present them as measured.
4. **Separate provenance.** Use `MEASURED`, `SYNTHETIC`, `FIXTURE`, `TARGET`, and `DESIGN` accurately.
5. **Policy beats optimization.** A high model/agent score cannot override a hard safety, permission, authorization, or budget rule.
6. **Fail closed for high-risk actions.** Missing required authorization or policy must not permit dangerous execution.
7. **Bound autonomy server-side.** Every autonomous run must enforce cost, iteration, time, and failure limits before continuing.
8. **Verify before complete.** An agent saying "done" is not evidence of completion.
9. **Explain decisions, not hidden reasoning.** Store structured inputs, policy matches, reason codes, scores, evidence references, and outcomes. Never request or expose private chain-of-thought.
10. **Typed contracts first.** Prefer Pydantic/domain models and explicit enums.
11. **Tests are part of implementation.** New decision behavior requires tests; critical runtime paths require integration coverage.

## Product boundary

The market already has multi-agent orchestration and swarm frameworks. Do not build another generic swarm.

Specialized workers may be used internally for a bounded engineering workflow, for example:

`INVESTIGATE → IMPLEMENT → VERIFY → REPAIR`

But worker count, agent-to-agent conversation, and swarm topology are not product goals.

The product goal is:

> **Why did the autonomous system take this action, what constrained it, what evidence justified it, and what proves the result?**

## Required runtime decisions

Use these semantic action outcomes:

- `ALLOW`
- `ROUTE`
- `RETRY`
- `FALLBACK`
- `ESCALATE`
- `BLOCK`

Use these bounded loop outcomes:

- `COMPLETE`
- `REPAIR`
- `REPLAN`
- `ESCALATE`
- `ABORT`

## Decision inputs

Consider where available:

- task/action type;
- agent identity;
- requested model/tool;
- capability;
- policy;
- risk;
- autonomy level;
- quality floor;
- latency budget;
- cost budget;
- historical evidence;
- current provider/tool health;
- previous run failures;
- loop iteration and hard limits.

## Decision order

Implement conceptually in this order:

`authorization → hard policy → risk/autonomy → tool permission → run limits → budget → quality/latency constraints → evidence → candidate scoring → decision`

Hard constraints must be resolved before optimization scoring.

## Engineering workflow

Before changing code:

1. Inspect repository structure.
2. Find current agent entrypoint and execution nodes.
3. Find provider/model adapters.
4. Find history/evidence persistence.
5. Find trajectory/event schemas.
6. Find APIs and frontend decision views.
7. Inspect tests and CI.
8. Identify the smallest compatible insertion point.
9. Implement one vertical slice.
10. Run tests/typecheck/lint/build as applicable.
11. Verify behavior in the actual runtime path.
12. Update documentation only after the implementation is truthful.

## Preferred MVP vertical slice

```text
Engineering task
  ↓
Assess / investigate
  ↓
Implement
  ↓
Independent verification
  ↓
Decision
  ├── COMPLETE
  ├── REPAIR
  ├── REPLAN
  ├── ESCALATE
  └── ABORT
```

The first compelling proof should demonstrate:

`FAIL → REPAIR → VERIFY → COMPLETE`

Do not add arbitrary agents just to make this sequence look more autonomous.

## Decision Ledger

Every important action must create a structured ledger entry before execution and link its outcome afterward.

Minimum fields:

- decision_id;
- run_id;
- agent_id where available;
- action/task type;
- risk/autonomy;
- policy version;
- constraints and limits;
- candidates;
- selected strategy;
- reason codes;
- evidence IDs/snapshot;
- estimated cost;
- actual model/tool;
- actual cost/latency;
- verification result;
- final outcome;
- timestamp.

The ledger is the product's core observable primitive.

## Hard stopping controls

Every autonomous run MUST have server-side enforcement for:

- `max_cost_usd`;
- `max_iterations`;
- `max_runtime_ms`;
- `max_failures`.

Before any new model/tool/worker action, check all applicable limits.

If a limit is reached, do not start another action. Return `ABORT` or `ESCALATE` according to policy.

A UI warning alone is not sufficient.

## Verification and repair

Verification must independently challenge the preceding work.

For coding/CI workflows, prefer real tests/checks such as unit tests, typecheck, build, lint, or other task-specific verification.

A repair step MUST reference concrete failure evidence. It must not simply ask an agent to "try again" without changing the hypothesis, plan, or implementation based on evidence.

Completion requires verification evidence appropriate to the task.

## Model routing

The existing model router remains a capability of the control plane.

Question to answer:

> Among policy-eligible strategies, which has the strongest evidence-backed tradeoff for this task and its constraints?

Do not hard-code a global winner. Do not report fixture data as measured. Do not claim cost/quality improvement until measured.

## Execution requirements

Real model/tool execution must:

- use existing adapter abstractions where possible;
- keep credentials in environment/config;
- enforce timeouts;
- classify failures;
- capture actual latency and usage/cost where available;
- normalize outputs;
- link execution to run/decision IDs;
- avoid secrets in logs/ledger.

Fixtures/mocks are allowed in tests and demos only when clearly labeled.

## Tool requirements

Every real tool requires:

- explicit name/version;
- typed/schema-validated input;
- server-side policy check;
- timeout;
- payload/input bound;
- bounded retries;
- idempotency strategy where relevant;
- sanitized result metadata;
- typed failure class;
- trajectory/ledger event.

Prefer read-only or sandboxed tools for the MVP.

## Reliability

Only classified retryable failures may produce `RETRY` or `FALLBACK`, and only within hard limits.

Never retry authorization, permission, validation, or policy failures as if they were transient infrastructure errors.

Circuit-breaker state should be scoped to provider/model/tool.

## Evidence

Evidence becomes eligible for future strategy selection only after evaluation/verification.

Evidence aggregation should account for:

- task similarity;
- sample size;
- freshness;
- quality/success;
- latency;
- cost;
- failure modes.

One anomalous record must not dominate mature evidence.

## Counterfactual replay

When implementing replay:

1. freeze original intent and evidence snapshot;
2. select alternative policy/model/strategy;
3. recompute the decision without executing dangerous actions;
4. compare actual and counterfactual decision, strategy, cost, latency, and benchmark-backed expected quality where available.

Replay is simulation by default.

## UI contract

Keep the primary navigation:

`RUN | DECISIONS | SETTINGS`

**RUN** should show task, iteration, risk, budget, current decision, action, verification, and outcome.

**DECISIONS** should make the Decision Ledger and **Why?** evidence inspectable.

**SETTINGS** should contain policies, models, tools, budgets, and runtime limits.

The CEO/CTO demo should be understandable in roughly 60 seconds:

`TASK → DECISION → EVIDENCE → ACTION → VERIFICATION → COMPLETE/REPAIR/ESCALATE`

Do not add a dashboard for every internal subsystem.

## Security

Never log or persist:

- API keys;
- bearer tokens;
- cookies;
- authorization headers;
- secrets;
- unnecessary sensitive payloads.

High-risk actions fail closed when required authorization/policy is unavailable.

Replay must not perform destructive real-world actions.

## Documentation truthfulness

Use these labels:

- **MEASURED:** reproducible real execution;
- **SYNTHETIC:** generated simulation;
- **FIXTURE:** static test/demo data;
- **TARGET:** desired future result/SLO;
- **DESIGN:** architectural intention.

Never convert a target or design statement into a measured claim.

## What not to do

Do not:

- rewrite the backend without necessity;
- build a generic multi-agent swarm framework;
- add dozens of agents/providers/tools;
- build an agent marketplace;
- build generic RAG;
- build full enterprise IAM;
- add RL/self-modifying policies;
- add Kubernetes orchestration;
- optimize UI before runtime proof;
- invent benchmark numbers;
- add dependencies without concrete need;
- expose private model reasoning.

## Definition of done

A slice is complete only when:

1. behavior exists in the real runtime path;
2. contracts are typed;
3. hard limits are enforced;
4. decision and outcome are observable;
5. verification is explicit;
6. evidence provenance is clear;
7. tests cover success and relevant failure paths;
8. existing behavior remains compatible unless intentionally changed;
9. documentation matches implementation;
10. tests/typecheck/build pass where applicable.
