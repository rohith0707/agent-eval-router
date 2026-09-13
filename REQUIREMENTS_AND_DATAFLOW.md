# Requirements & Dataflow — Agent Decision Engine

## 1. System boundary

The product is a **runtime decision layer**, not the agent itself. An external or internal agent submits an intended action; the decision engine determines whether and how that action may execute.

```text
Agent / User
    |
    v
[1] Intent Intake
    |
    v
[2] Task + Action Analysis
    |
    +----> risk / budget / latency / quality / autonomy
    |
    v
[3] Evidence Retrieval <---- PostgreSQL Evidence Store
    |
    v
[4] Candidate Generation
    |       |
    |       +--> models
    |       +--> tools
    |       +--> fallback strategies
    |
    v
[5] Policy + Constraint Evaluation
    |
    v
[6] Decision Engine
    |
    +--> ALLOW
    +--> ROUTE
    +--> RETRY
    +--> FALLBACK
    +--> ESCALATE
    +--> BLOCK
    |
    v
[7] Guarded Execution
    |       |
    |       +--> model adapter
    |       +--> tool adapter
    |       +--> timeout / retry / circuit breaker
    |
    v
[8] Outcome + Trajectory
    |
    v
[9] Evaluation
    |
    v
[10] Evidence Persistence
    |
    +-------------------------------> future decisions
```

## 2. Required data contracts

### IntentRequest

```json
{
  "run_id": "string",
  "agent_id": "string",
  "task": "string",
  "action_type": "model_call | tool_call | workflow_step",
  "requested_model": "string|null",
  "requested_tool": "string|null",
  "quality_floor": 0.0,
  "latency_budget_ms": 0,
  "cost_budget_usd": 0.0,
  "risk_class": "low | medium | high | critical",
  "autonomy_level": "auto | approval | blocked"
}
```

### EvidenceRecord

```json
{
  "evidence_id": "string",
  "task_type": "string",
  "model": "string|null",
  "tool": "string|null",
  "success": true,
  "quality": 0.0,
  "latency_ms": 0,
  "cost_usd": 0.0,
  "failure_class": "string|null",
  "policy_version": "string",
  "created_at": "ISO-8601"
}
```

### DecisionRecord

```json
{
  "decision_id": "string",
  "run_id": "string",
  "action": "ALLOW | ROUTE | RETRY | FALLBACK | ESCALATE | BLOCK",
  "selected_model": "string|null",
  "selected_tool": "string|null",
  "policy_version": "string",
  "risk_class": "string",
  "estimated_cost_usd": 0.0,
  "reason_codes": ["string"],
  "evidence_ids": ["string"],
  "candidate_scores": {},
  "created_at": "ISO-8601"
}
```

## 3. Decision sequence

```text
1. Agent submits intended action.
2. Validate request schema and run identity.
3. Classify task/action and risk.
4. Load applicable policy.
5. Retrieve relevant historical evidence.
6. Generate eligible model/tool candidates.
7. Remove candidates forbidden by policy.
8. Score remaining candidates against capability, evidence, reliability, cost and constraints.
9. Determine autonomy requirement.
10. Emit DecisionRecord before execution.
11. Execute only the selected/allowed action.
12. Capture raw operational metadata without secrets.
13. Classify failure if execution fails.
14. Retry or fallback only within policy limits.
15. Evaluate outcome.
16. Persist EvidenceRecord linked to DecisionRecord.
17. Update aggregate evidence used by future decisions.
```

## 4. Policy evaluation order

The runtime SHOULD evaluate in this order:

```text
Identity / authorization
        ↓
Hard safety / block rules
        ↓
Risk threshold
        ↓
Tool permission
        ↓
Budget constraint
        ↓
Quality / latency constraints
        ↓
Historical evidence
        ↓
Candidate scoring
        ↓
Autonomy / approval decision
```

Hard policy constraints must not be overridden by a high model score.

## 5. Candidate scoring

Use a transparent scoring interface. A candidate can expose:

- capability score
- historical success/quality
- evidence sample size
- evidence freshness
- reliability score
- expected latency
- expected cost
- risk penalty
- constraint violations

The implementation may use a weighted score, but the UI must show the inputs that caused the winner/rejection. Avoid claiming that arbitrary weights are universally optimal.

## 6. Tool execution requirements

Every real tool adapter MUST provide:

- explicit tool name and version
- JSON/schema validation
- permission/policy check
- timeout
- payload/input size bound
- bounded retries
- idempotency strategy where relevant
- sanitized result metadata
- typed failure class
- trajectory event

Minimum failure classes:

`AUTH | PERMISSION | VALIDATION | TIMEOUT | RATE_LIMIT | QUOTA | SERVER | NETWORK | UNKNOWN`

## 7. Model execution requirements

Every model adapter MUST provide:

- provider/model identifier
- request timeout
- bounded retry behavior
- token/usage metadata when available
- latency
- estimated or actual cost
- normalized response
- failure classification
- trajectory event

The production execution path MUST NOT use hard-coded quality, latency, cost, or success values as if they were measurements.

## 8. Reliability flow

```text
Execution failure
      |
      v
Classify failure
      |
      +-- non-retryable --> record + evaluate/fail
      |
      +-- retryable ------> retry budget available?
                               |
                         +-----+-----+
                         |           |
                        yes          no
                         |           |
                       RETRY     circuit state
                                     |
                                  FALLBACK?
                                     |
                              +------+------+
                              |             |
                             yes            no
                              |             |
                         alternate      ESCALATE/FAIL
                         strategy
```

Circuit breakers must be scoped to provider/model/tool and use a bounded recovery policy.

## 9. Evidence feedback loop

Evidence must influence future decisions only after an outcome is evaluated.

```text
Decision D1
   ↓
Execution E1
   ↓
Evaluation V1
   ↓
Evidence R1
   ↓
Evidence aggregation
   ↓
Decision D2 receives R1
```

Evidence should be task-similar and freshness-aware. A single anomalous run must not dominate a mature evidence set.

## 10. Replay dataflow

```text
Historical Decision
        ↓
Freeze original inputs/evidence snapshot
        ↓
Select alternative policy/configuration
        ↓
Recompute decision
        ↓
Compare
  - action
  - model/tool
  - estimated cost
  - estimated latency
  - policy result
  - expected quality where benchmark evidence exists
```

Replay is initially a simulation/counterfactual feature; it must not execute dangerous real-world actions.

## 11. Observability events

Minimum event types:

`RUN_STARTED`
`INTENT_ANALYZED`
`POLICY_EVALUATED`
`EVIDENCE_RETRIEVED`
`CANDIDATES_SCORED`
`DECISION_MADE`
`MODEL_STARTED`
`MODEL_COMPLETED`
`TOOL_AUTHORIZED`
`TOOL_STARTED`
`TOOL_COMPLETED`
`RETRY_STARTED`
`FALLBACK_STARTED`
`ESCALATION_REQUIRED`
`ACTION_BLOCKED`
`EVALUATION_COMPLETED`
`EVIDENCE_RECORDED`
`RUN_COMPLETED`

Every event should include `run_id`, timestamp, and when applicable `decision_id`.

## 12. Security requirements

- Never store API keys, access tokens, authorization headers, or raw secrets in traces.
- Tool permissions must be evaluated server-side.
- High-risk actions must fail closed when authorization/policy is unavailable.
- Logs should store metadata and redacted payloads rather than sensitive raw data.
- Approval decisions must be auditable.
- Replay must default to non-destructive simulation.

## 13. MVP implementation order

1. Add DecisionRecord and decision enum.
2. Add policy evaluator with hard constraints.
3. Put policy evaluation before current model routing.
4. Replace mock model execution with one real provider adapter.
5. Replace synthetic tool execution with one real bounded tool.
6. Persist real outcome/evaluation evidence.
7. Add fallback/circuit-breaker behavior.
8. Add decision console explaining evidence and policy.
9. Add replay after the real loop is trustworthy.

## 14. Acceptance test: the complete loop

A single automated integration test should demonstrate:

```text
intent
 → policy
 → evidence retrieval
 → decision
 → real model/tool
 → evaluation
 → persisted evidence
 → second decision uses the new evidence
```

This is the primary proof that the product is an actual decision engine rather than a UI around synthetic metrics.
