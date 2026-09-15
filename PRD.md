# PRD — Evidence-Driven Agent Control Plane

**Product:** Agent Eval Router → Evidence-Driven Agent Control Plane
**Status:** Product direction locked
**Audience:** CTOs, AI platform teams, AgentOps teams, AI/Applied AI engineers
**Primary goal:** Make autonomous AI work controllable, verifiable, explainable, and economically bounded.

## 1. Product thesis

AI agents are becoming capable of taking real actions. The hard production problem is no longer only "which model gives the best answer?" It is **whether an autonomous action should happen, how it should happen, what evidence justifies it, and whether the result is actually trustworthy.**

This product is the runtime control plane between an agent and the models/tools it can use. It evaluates policy, risk, budget, reliability, constraints, and historical execution evidence before important actions. After execution it evaluates the outcome and records a decision ledger that can drive the next decision.

### One-line description
> **The control plane for autonomous AI work: decide, constrain, verify, and explain what agents do.**

### Core loop

`Intent → Policy → Evidence → Decision → Action → Verification → Evidence → Next Decision`

### Product distinction

The product does **not** compete as another multi-agent framework, swarm runtime, chatbot, model gateway, or generic observability dashboard. Multi-agent execution may be an implementation strategy for selected workflows, but orchestration is not the product promise.

The core primitive is the **Decision** and its **evidence trail**.

## 2. Executive problem

Organizations are deploying increasingly autonomous agents across coding, research, support, operations, finance, and internal workflows. These agents can select models, call tools, retry failures, change strategy, and continue work without a human at every step.

That creates five executive questions:

1. **Control:** What is an agent allowed to do?
2. **Trust:** What evidence proves an action or result is safe and correct?
3. **Economics:** Why did the system spend this money, and could it have used a cheaper strategy?
4. **Reliability:** What happens when a model, tool, or agent fails?
5. **Accountability:** Can we reconstruct why the system acted, changed strategy, retried, escalated, or stopped?

The product exists to answer those questions at runtime.

## 3. Target users

### Primary
- CTOs and engineering leaders operating autonomous AI systems.
- AI platform / AgentOps engineers responsible for reliability, cost, evaluation, and governance.
- AI/Applied AI engineers building production agents.

### Secondary
- Security/platform teams defining runtime boundaries.
- Engineering teams that need verifiable autonomous coding or operational workflows.

## 4. Product experience

The user submits an agent task or the platform receives an intended agent action.

The control plane:

1. analyzes task/action requirements;
2. identifies risk and autonomy level;
3. loads applicable policy;
4. retrieves relevant historical evidence;
5. generates eligible strategies;
6. decides whether to allow, route, retry, fallback, escalate, or block;
7. executes only within the decision boundary;
8. verifies the result;
9. records the complete decision ledger;
10. decides whether the run is complete or requires bounded repair/retry.

### Important UX principle

The UI should make this question immediately answerable:

> **Why did the system do this, and what proves it was the right thing to do?**

## 5. Decision Ledger

Every important runtime action produces a structured ledger entry:

```text
Intent
  ↓
Policy / Risk / Constraints
  ↓
Evidence used
  ↓
Decision
  ↓
Action executed
  ↓
Actual cost / latency / failure
  ↓
Verification result
  ↓
Final outcome
```

The ledger must expose decision inputs and evidence references, not private chain-of-thought.

A reviewer should be able to inspect one run and answer:

- What did the agent want to do?
- What was allowed or denied?
- Which policy applied?
- What evidence was used?
- Which alternatives were considered?
- Why was the winner selected?
- What actually happened?
- What did it cost?
- Did verification pass?
- What happens next?

## 6. Closed-loop execution

The product may use specialized workers internally for bounded workflows, but it must not expose "many agents talking to each other" as the value proposition.

For an engineering task, a controlled loop can look like:

```text
TASK
 ↓
ASSESS
 ↓
INVESTIGATE
 ↓
IMPLEMENT
 ↓
VERIFY
 ↓
CONTROL PLANE
 ├── COMPLETE
 ├── REPAIR
 ├── RETRY
 ├── REPLAN
 ├── ESCALATE
 └── ABORT
```

A loop may continue only while hard limits permit it:

- maximum iterations;
- maximum cost;
- maximum wall-clock time;
- maximum consecutive failures;
- required verification/confidence threshold;
- policy/autonomy boundary.

### Loop rule

**The system must never equate "agent says done" with "task is verified."**

Completion requires explicit verification evidence appropriate to the task.

## 7. Functional requirements

### FR-1 Intent and task analysis — MUST
Normalize incoming work into task/action type, quality floor, latency target, cost budget, risk class, requested model/tool, autonomy level, and relevant constraints.

### FR-2 Runtime policy — MUST
Support declarative rules for permitted models/providers, permitted tools, spend limits, latency limits, risk thresholds, approval requirements, retry/fallback limits, and blocked actions.

### FR-3 Decision engine — MUST
Return one explicit semantic outcome:

`ALLOW | ROUTE | RETRY | FALLBACK | ESCALATE | BLOCK`

Loop-level outcomes may additionally be:

`COMPLETE | REPAIR | REPLAN | ABORT`

### FR-4 Evidence-aware strategy selection — MUST
Select among policy-eligible strategies using historical measured evidence where available. Evidence must be task-similar and freshness-aware.

### FR-5 Tool authorization — MUST
Every external tool call passes server-side policy/permission checks and bounded schema, payload, timeout, retry, and failure handling.

### FR-6 Budget enforcement — MUST
Estimate and enforce per-action and per-run budget before expensive execution. Actual usage must update the ledger.

### FR-7 Risk and autonomy — MUST
Classify actions and enforce an autonomy policy. High-risk actions must support approval or blocking and fail closed when required policy/authorization is unavailable.

### FR-8 Reliability — MUST
Support bounded retry, fallback, timeout handling, failure classification, and circuit-breaker state for repeated transient failures.

### FR-9 Verification/evaluation — MUST
Evaluate actual execution outcomes. Production quality cannot be a hard-coded constant. Verification must produce structured evidence.

### FR-10 Decision Ledger persistence — MUST
Persist decision ID, run ID, action/task type, policy version, candidates, selected strategy, reason codes, evidence references, model/tool, constraints, actual latency/cost, outcome, evaluation/verification, failure class, and timestamp.

### FR-11 Bounded repair loop — MUST for MVP demo
Support at least one controlled `FAIL → REPAIR → VERIFY → COMPLETE` workflow without exceeding runtime limits.

### FR-12 Counterfactual decision replay — SHOULD
Replay a historical decision with an alternative policy/configuration without performing dangerous real-world actions. Show how the decision, strategy, expected cost/latency, and benchmark-backed expected quality differ.

### FR-13 Pause/kill — SHOULD
Provide a run-level control that prevents further execution after a kill/pause decision.

## 8. Non-functional requirements

- Python/FastAPI remains the primary runtime.
- Next.js remains the decision console.
- PostgreSQL remains the intended durable evidence store; implementation claims must match the actual repository state.
- Provider and tool adapters remain isolated behind interfaces.
- All external calls have bounded timeouts.
- Secrets never enter decision records or logs.
- Every execution path is attributable to run ID and decision ID.
- Policy evaluation is deterministic for the same policy, inputs, and evidence snapshot.
- Measured, fixture, synthetic, target, and design data remain explicitly distinguishable.
- Runaway loops must be physically bounded by server-side controls, not only UI messaging.

## 9. Decision model

Conceptually:

`DecisionScore = capability + evidence + reliability + constraint_fit - cost_penalty - risk_penalty`

This is an implementation interface, not a scientifically optimal formula. Hard policy constraints always dominate optimization scores.

The UI must explain candidate differences using observable inputs rather than hidden reasoning.

## 10. Autonomy model

| Risk | Default autonomy | Example |
|---|---|---|
| Low | Auto | summarize or classify information |
| Medium | Auto with limits | routine reversible workflow |
| High | Approval | high-value business action or production change |
| Critical | Block / multi-party approval | irreversible financial, security, or destructive action |

## 11. MVP proof scenarios

### Scenario A — Economic decision
A task has a quality floor and strict budget. The control plane selects a policy-eligible strategy using evidence and records why alternatives were rejected.

### Scenario B — High-risk action
An agent requests a sensitive or destructive action. The control plane returns `ESCALATE` or `BLOCK`; no dangerous action executes before approval.

### Scenario C — Reliability recovery
A selected provider/tool fails with a retryable failure. The control plane performs bounded retry/fallback, records the failure, and evaluates the successful result.

### Scenario D — Closed-loop engineering
A coding task fails verification. A bounded repair step runs, independent verification executes again, and the run reaches `COMPLETE` only when verification evidence passes.

### Scenario E — Counterfactual
A historical run is replayed under a different routing/policy configuration. The UI shows actual decision versus counterfactual decision without executing destructive actions.

## 12. CEO/CTO demo requirement

The primary demo must be understandable in approximately 60 seconds.

Show one run with:

```text
TASK
→ decision
→ evidence
→ action
→ verification
→ COMPLETE / REPAIR / ESCALATE
```

The strongest demo is not the number of agents. It is the ability to inspect a decision and its proof.

## 13. UI requirements

Keep navigation intentionally small:

- **RUN** — execute/observe a task, loop state, budget, risk, and verification.
- **DECISIONS** — inspect the Decision Ledger and "Why?" evidence.
- **SETTINGS** — policies, models, tools, budgets, runtime limits.

A decision detail view should show:

- requested action;
- policy result;
- risk/autonomy;
- candidates and rejection reasons;
- evidence references;
- selected model/tool/strategy;
- actual cost/latency;
- verification;
- retry/fallback/repair history;
- final outcome.

## 14. Success metrics

All product claims require reproducible evidence.

Minimum benchmark:

- 15–20 representative tasks;
- baseline versus evidence-driven strategy;
- task success/quality;
- latency;
- cost;
- tool correctness where relevant;
- failure/fallback rate;
- policy compliance;
- at least one bounded repair loop;
- at least one blocked/escalated action;
- reproducible stored inputs and outputs.

Do not publish cost savings, quality improvements, reliability improvements, or production SLOs until measured.

## 15. Scope guard

### In scope

- runtime policy and decisioning;
- Decision Ledger;
- real model/tool execution;
- evidence-backed routing;
- bounded retry/fallback;
- verification/evaluation;
- one closed-loop engineering workflow;
- counterfactual replay after the core loop is trustworthy.

### Explicitly out of scope for MVP

- generic multi-agent swarm framework;
- agent marketplace;
- dozens of agents/tools/providers;
- generic RAG platform;
- full enterprise IAM suite;
- autonomous self-modifying policies;
- RL-based routing;
- Kubernetes control plane;
- large BI/analytics suite;
- autonomous destructive actions.

## 16. Implementation priority

**P0 — Decision Ledger**

Why: this is the product's unique observable primitive.

Done when: one run has an inspectable end-to-end trail from intent through policy, evidence, decision, action, verification, and outcome.

**P0 — Closed-loop repair**

Why: proves bounded autonomy instead of another one-shot agent.

Done when: one engineering task demonstrates `FAIL → REPAIR → VERIFY → COMPLETE`.

**P0 — Hard stopping controls**

Why: autonomous systems must be unable to run indefinitely.

Done when: max cost, iterations, wall-clock time, failures, and explicit abort prevent further execution server-side.

**P1 — Counterfactual routing/replay**

Why: turns the system from an observer into a decision-improvement engine.

Done when: a historical run can show actual versus alternative strategy/policy outcomes without executing dangerous actions.

**P1 — CEO-grade demo**

Why: the value must be obvious without an architecture lecture.

Done when: a reviewer can understand one complete run, its decisions, and proof in roughly 60 seconds.

## 17. Definition of done

The product direction is credible when a reviewer can run one real task and inspect:

`Task → Policy → Evidence → Decision → Real Action → Verification → Evidence → Next Decision`

and the system can prove that:

1. autonomy was bounded;
2. important actions had explicit decisions;
3. policy could stop an action;
4. execution produced measured operational evidence;
5. verification determined completion;
6. failure could trigger bounded repair/recovery;
7. the ledger explains why the system acted;
8. no invented benchmark data is presented as fact.
