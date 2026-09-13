# PRD — Evidence-Driven Agent Decision Engine

**Product:** Agent Eval Router → Evidence-Driven Agent Decision Engine
**Status:** Updated product direction
**Audience:** Engineers building production AI agents, AI platform teams, AgentOps/LLMOps teams
**Primary goal:** Make an agent's important runtime decisions explainable, policy-aware, evidence-driven, and measurable.

## 1. Product thesis

AI agents are moving from generating answers to taking actions. The production problem is therefore not only model quality; it is deciding **whether, how, and under what constraints an agent should act**.

This product is a runtime decision layer around agents. Before an important model or tool action executes, it evaluates task requirements, policy, risk, budget, reliability, model/tool capability, and historical evidence. It returns an explicit decision and records the outcome as evidence for future decisions.

### One-line description
> An evidence-driven runtime decision engine that decides what an AI agent should do next — which model or tool to use, how much it can spend, whether approval is required, and when it should stop.

### Differentiator
The core primitive is **Decision**, not Chat, Model, Tool, or Dashboard.

`Intent → Decision → Action → Outcome → Evidence → Better Decision`

## 2. Problem

Production agents increasingly interact with models, APIs, databases, SaaS systems, and sensitive business actions. Static model selection and application-level if/else logic do not provide a unified way to answer:

- Should this action execute?
- Which model is appropriate for this task and constraint set?
- Which tool is allowed?
- How much budget can be consumed?
- Does the action require approval?
- Should the system retry, fallback, escalate, or stop?
- Why was this decision made?
- Did the decision actually work?
- What evidence should influence the next decision?

## 3. Target users

### Primary
- AI/Applied AI engineers building production agents.
- AI platform and AgentOps engineers responsible for runtime reliability, cost, evaluation, and governance.
- Teams operating multiple models and tools.

### Secondary
- Engineering leads evaluating agent reliability and economics.
- Security/platform teams needing runtime policy boundaries.

## 4. Core user journey

1. Submit an agent task or receive an agent action request.
2. Extract task/action requirements.
3. Retrieve applicable policies and historical evidence.
4. Generate candidate model/tool/action strategies.
5. Score candidates against quality, reliability, cost, risk, and constraints.
6. Produce an explicit decision: `ALLOW`, `ROUTE`, `RETRY`, `FALLBACK`, `ESCALATE`, or `BLOCK`.
7. Execute only what the decision permits.
8. Evaluate the result and trajectory.
9. Persist the decision, evidence, outcome, cost, latency, and failure class.
10. Use accumulated evidence in future decisions.

## 5. Product principles

### 5.1 Decision first
Every meaningful runtime action should have a machine-readable decision record.

### 5.2 Evidence over claims
Routing and policy optimization must use measured execution evidence when available. Fixtures and synthetic examples must be explicitly labeled.

### 5.3 Fail closed for high-risk actions
If policy or authorization information is missing for a high-risk action, do not silently execute it.

### 5.4 Bounded autonomy
The engine should control the amount of autonomy granted to an agent per action.

### 5.5 Explainability without hidden reasoning
Expose decision inputs, policy matches, scores, constraints, evidence references, and outcomes. Do not store or expose private chain-of-thought.

### 5.6 Real execution before polish
A smaller number of real model/tool integrations is more valuable than a large simulated surface.

## 6. Functional requirements

### FR-1 Task and action analysis
The system MUST normalize an incoming task/action into structured requirements including task type, required quality, latency target, budget, risk class, requested tool, and autonomy level where applicable.

### FR-2 Policy engine
The system MUST support declarative policies for:
- permitted models/providers
- permitted tools
- spend limits
- latency limits
- risk thresholds
- approval requirements
- retry/fallback limits
- blocked actions

### FR-3 Decision engine
The system MUST return one explicit decision:
- `ALLOW` — execute requested action.
- `ROUTE` — modify model/tool strategy and execute.
- `RETRY` — retry under bounded retry policy.
- `FALLBACK` — switch provider/model/tool after a classified failure.
- `ESCALATE` — require human approval or higher-trust execution path.
- `BLOCK` — refuse execution.

### FR-4 Evidence-aware routing
The existing model router MUST remain as a decision capability. Historical task-similar outcomes should influence model/provider selection subject to current policy and constraints.

### FR-5 Tool authorization
Every external tool invocation MUST pass a policy check before execution. Tool calls MUST have schema validation, timeout, payload bounds, and a classified failure result.

### FR-6 Budget guard
The engine MUST estimate and enforce per-run/per-action budget limits. If an action would exceed the allowed budget, it MUST route, escalate, or block according to policy.

### FR-7 Risk and approval
Actions MUST receive a risk class. High-risk actions MUST be able to require approval or be blocked.

### FR-8 Reliability controls
The runtime MUST support bounded retries, provider fallback, timeout handling, and circuit-breaker state for repeated transient failures.

### FR-9 Evaluation
The system MUST evaluate final outcomes and, where possible, tool correctness and trajectory-level behavior. Evaluation must produce measurable fields rather than a hard-coded quality value in the real execution path.

### FR-10 Evidence persistence
Each completed or blocked decision MUST persist:
- decision ID
- run ID
- task/action type
- policy version
- candidate strategies
- selected strategy
- decision reason
- evidence references
- model/tool
- latency
- cost
- outcome
- quality/evaluation result
- failure class
- timestamp

### FR-11 Decision replay
The system SHOULD support replaying a historical decision with a different policy/configuration and comparing expected cost, latency, quality, and decision outcome.

### FR-12 Kill/pause control
The system SHOULD support an agent/run pause or kill control that prevents further action execution.

## 7. Non-functional requirements

- Python/FastAPI backend remains the primary agent runtime.
- Next.js frontend remains the decision console.
- PostgreSQL remains the durable evidence store.
- Provider/tool adapters must be isolated behind interfaces.
- External calls require bounded timeouts.
- Secrets must never be persisted in decision records or logs.
- Every execution path must be traceable by run ID and decision ID.
- Policy evaluation must be deterministic for the same policy, inputs, and evidence snapshot.
- Production metrics must distinguish measured data from synthetic/demo fixtures.

## 8. Decision model

A candidate strategy should be evaluated conceptually using:

`DecisionScore = capability + evidence + reliability + constraint_fit - cost_penalty - risk_penalty`

The exact weights are configurable and must not be presented as scientifically optimal. Historical evidence should be similarity-aware and freshness-aware.

## 9. Autonomy model

| Risk | Default autonomy | Example |
|---|---|---|
| Low | Auto | summarize documents |
| Medium | Auto with limits | send routine email |
| High | Approval | refund above threshold |
| Critical | Block or multi-party approval | irreversible financial/security action |

## 10. MVP scenarios

### Scenario A — Economic routing
A task requires quality >= 0.90 and budget <= $2. The decision engine selects the cheapest historically reliable model satisfying the constraints.

### Scenario B — Dangerous tool action
An agent requests a high-value refund. Policy detects the risk threshold and returns `ESCALATE` rather than allowing direct execution.

### Scenario C — Reliability fallback
Provider A times out repeatedly. The engine classifies the failure, trips a bounded circuit breaker, routes to provider B, and records the outcome as evidence.

## 11. UI requirements

Keep the navigation intentionally small:

- **RUN** — submit task, view active execution, outcome, cost, latency, and controls.
- **DECISIONS** — inspect why a decision happened; candidates, evidence, policy, constraints, winner/rejection, and outcome.
- **SETTINGS** — models, tools, policies, budgets.

The primary UI question is:
> **Why did the agent make this decision?**

## 12. Success metrics

Product success is measured using reproducible benchmark runs, not invented dashboard numbers.

Minimum benchmark:
- 15–20 representative tasks.
- Baseline policy versus evidence-driven policy.
- Measure success/quality, latency, cost, tool correctness, and failure rate.
- Include at least one failure/fallback scenario and one policy-block/approval scenario.
- Store benchmark inputs and outputs so results can be reproduced.

## 13. Out of scope for MVP

- Building a new agent framework.
- Multi-agent swarm orchestration.
- Generic RAG platform.
- Dozens of tool integrations.
- Full enterprise IAM suite.
- Autonomous self-modifying policies.
- RL-based routing.
- Kubernetes control plane.
- Large analytics/BI system.

## 14. Implementation priority

P0: real model execution.
P0: one real bounded tool.
P0: decision/policy layer around execution.
P0: empirical evaluation and evidence persistence.
P1: fallback/circuit breaker hardening.
P1: decision replay.
P1: pause/kill control.
P2: additional providers/tools and enterprise features.

## 15. Definition of done for the product direction

A reviewer can run one task and see:

`Task → Policy → Evidence → Decision → Real Model/Tool → Evaluation → Evidence`

and answer, from the UI and persisted trace:

1. What did the agent want to do?
2. What did the decision engine allow or change?
3. Why?
4. What actually happened?
5. What did it cost?
6. Did it work?
7. What evidence will affect the next decision?
