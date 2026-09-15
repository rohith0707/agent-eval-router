# Requirements & Dataflow — Evidence-Driven Agent Control Plane

## 1. System boundary

The product is a **runtime control plane**, not a replacement agent framework. An internal or external agent submits an intended action/task; the control plane determines whether and how that work may proceed, verifies the result, records evidence, and decides what happens next.

Multi-agent workers may be used inside a bounded workflow, but they are implementation details rather than the product boundary.

```text
Agent / User
    |
    v
[1] Intent Intake
    |
    v
[2] Task + Action Analysis
    |       |
    |       +--> risk / budget / latency / quality / autonomy
    |       +--> loop limits
    |
    v
[3] Policy Evaluation
    |
    v
[4] Evidence Retrieval <---- Evidence Store
    |
    v
[5] Candidate / Strategy Generation
    |       |
    |       +--> model strategy
    |       +--> tool strategy
    |       +--> worker/repair strategy where workflow requires it
    |
    v
[6] Decision Engine
    |
    +--> ALLOW / ROUTE / RETRY / FALLBACK / ESCALATE / BLOCK
    |
    v
[7] Guarded Execution
    |       |
    |       +--> model adapter
    |       +--> bounded tool adapter
    |       +--> optional bounded specialist worker
    |
    v
[8] Verification / Evaluation
    |
    v
[9] Decision Ledger + Evidence
    |
    v
[10] Loop Controller
     |
     +--> COMPLETE
     +--> REPAIR
     +--> REPLAN
     +--> RETRY
     +--> ESCALATE
     +--> ABORT
     |
     +--------------------> next bounded decision
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
  "autonomy_level": "auto | approval | blocked",
  "max_iterations": 0,
  "max_failures": 0,
  "max_runtime_ms": 0
}
```

### EvidenceRecord

```json
{
  "evidence_id": "string",
  "run_id": "string",
  "decision_id": "string|null",
  "task_type": "string",
  "model": "string|null",
  "tool": "string|null",
  "success": true,
  "quality": 0.0,
  "latency_ms": 0,
  "cost_usd": 0.0,
  "failure_class": "string|null",
  "verification": {"status": "pass | fail | partial"},
  "provenance": "MEASURED | SYNTHETIC | FIXTURE | TARGET | DESIGN",
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
  "selected_strategy": "string|null",
  "policy_version": "string",
  "risk_class": "string",
  "autonomy_level": "auto | approval | blocked",
  "estimated_cost_usd": 0.0,
  "constraints": {},
  "reason_codes": ["string"],
  "evidence_ids": ["string"],
  "candidate_scores": {},
  "created_at": "ISO-8601"
}
```

### VerificationRecord

```json
{
  "verification_id": "string",
  "run_id": "string",
  "decision_id": "string",
  "status": "pass | fail | partial",
  "checks": [{"name": "string", "status": "pass | fail", "evidence_ref": "string|null"}],
  "reason_codes": ["string"],
  "created_at": "ISO-8601"
}
```

### LoopState

```json
{
  "run_id": "string",
  "iteration": 1,
  "max_iterations": 5,
  "spent_cost_usd": 0.0,
  "max_cost_usd": 2.0,
  "elapsed_ms": 0,
  "max_runtime_ms": 120000,
  "consecutive_failures": 0,
  "max_failures": 3,
  "status": "RUNNING | COMPLETE | REPAIR | REPLAN | ESCALATE | ABORT"
}
```

## 3. Decision sequence

1. Validate request and run identity.
2. Normalize task/action requirements.
3. Classify risk and autonomy.
4. Load applicable policy.
5. Enforce hard authorization and safety constraints.
6. Retrieve relevant historical evidence.
7. Generate policy-eligible strategies.
8. Estimate cost and constraint fit before expensive execution.
9. Score candidates using transparent evidence-backed inputs.
10. Emit a DecisionRecord before execution.
11. Execute only what the decision permits.
12. Capture actual latency, usage, cost, and failure metadata.
13. Verify/evaluate the outcome.
14. Persist DecisionRecord, VerificationRecord, and EvidenceRecord.
15. Update bounded loop state.
16. Decide `COMPLETE`, `REPAIR`, `REPLAN`, `RETRY`, `ESCALATE`, or `ABORT`.
17. If another iteration is allowed, create a new decision linked to the same run.

## 4. Policy evaluation order

```text
Identity / authorization
        ↓
Hard safety / block rules
        ↓
Risk / autonomy threshold
        ↓
Tool permission
        ↓
Run limits: cost / iterations / time / failures
        ↓
Quality / latency constraints
        ↓
Historical evidence
        ↓
Candidate scoring
        ↓
Decision
```

Hard policy constraints must never be overridden by a high model or agent score.

## 5. Decision and loop semantics

### Runtime action decisions

- `ALLOW` — execute requested action.
- `ROUTE` — modify model/tool/strategy and execute.
- `RETRY` — repeat a retryable operation within limits.
- `FALLBACK` — switch to an eligible alternate strategy.
- `ESCALATE` — require human approval or a higher-trust path.
- `BLOCK` — refuse execution.

### Loop decisions

- `COMPLETE` — verification evidence satisfies completion criteria.
- `REPAIR` — verification found a bounded correctable failure.
- `REPLAN` — current plan is invalid or insufficient.
- `ESCALATE` — autonomy boundary requires a human/higher-trust path.
- `ABORT` — a hard limit, safety rule, or unrecoverable condition prevents continuation.

A loop controller must not continue solely because an agent claims success.

## 6. Candidate scoring

A candidate may expose:

- capability;
- historical success/quality;
- evidence sample size;
- evidence freshness;
- reliability;
- expected latency;
- expected cost;
- risk penalty;
- constraint violations.

Conceptually:

`DecisionScore = capability + evidence + reliability + constraint_fit - cost_penalty - risk_penalty`

Weights are configurable and are not assumed universally optimal. Hard constraints are applied before scoring.

## 7. Evidence rules

Evidence becomes eligible for future routing only after evaluation/verification.

```text
Decision D1
   ↓
Execution E1
   ↓
Verification V1
   ↓
Evidence R1
   ↓
Evidence aggregation
   ↓
Decision D2
```

Evidence aggregation must consider task similarity, sample size, freshness, success/quality, latency, cost, and failure modes. One anomalous run must not dominate mature evidence.

## 8. Tool execution requirements

Every real tool adapter MUST provide:

- explicit name/version;
- schema validation;
- server-side permission check;
- timeout;
- input/payload bound;
- bounded retries;
- idempotency strategy where relevant;
- sanitized result metadata;
- typed failure class;
- trajectory/ledger event.

Minimum failure classes:

`AUTH | PERMISSION | VALIDATION | TIMEOUT | RATE_LIMIT | QUOTA | SERVER | NETWORK | UNKNOWN`

## 9. Model execution requirements

Every model adapter MUST provide:

- provider/model identifier;
- timeout;
- bounded retry behavior;
- token/usage metadata where available;
- actual latency;
- estimated or actual cost;
- normalized response;
- failure classification;
- ledger/trajectory event.

The real execution path must never use hard-coded quality, latency, cost, or success values as measurements.

## 10. Reliability flow

```text
Execution failure
      |
      v
Classify failure
      |
      +-- non-retryable --> record + verify/fail
      |
      +-- retryable ------> retry budget available?
                               |
                         +-----+-----+
                         |           |
                        yes          no
                         |           |
                       RETRY     fallback eligible?
                                     |
                                +----+----+
                                |         |
                               yes        no
                                |         |
                            FALLBACK   ESCALATE/ABORT
```

Circuit-breaker state must be scoped to provider/model/tool and use bounded recovery.

## 11. Closed-loop engineering workflow

The MVP engineering workflow may use specialized roles, but must remain bounded and evidence-driven:

```text
Task
 ↓
Investigation
 ↓
Implementation
 ↓
Independent Verification
 ↓
Control Plane
 ├── COMPLETE
 ├── REPAIR
 ├── REPLAN
 ├── ESCALATE
 └── ABORT
```

A repair iteration must have a concrete failure/evidence reference. The system must not create arbitrary additional agents merely to make the demo look autonomous.

## 12. Hard stopping controls

Every autonomous run MUST have server-side values for:

- `max_cost_usd`;
- `max_iterations`;
- `max_runtime_ms`;
- `max_failures`.

Before starting another action, the runtime must check all limits. Hitting a limit produces `ABORT` or `ESCALATE` according to policy.

An explicit kill/pause signal must prevent subsequent execution.

## 13. Decision Ledger event model

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
`VERIFICATION_STARTED`
`VERIFICATION_COMPLETED`
`REPAIR_STARTED`
`RETRY_STARTED`
`FALLBACK_STARTED`
`ESCALATION_REQUIRED`
`ACTION_BLOCKED`
`EVIDENCE_RECORDED`
`RUN_COMPLETED`
`RUN_ABORTED`

Every event includes `run_id`, timestamp, and `decision_id` where applicable.

## 14. Counterfactual replay dataflow

```text
Historical Run
    ↓
Freeze original intent + evidence snapshot
    ↓
Select alternative policy/model/strategy
    ↓
Recompute decision
    ↓
Compare actual vs counterfactual
  - decision
  - model/tool/strategy
  - estimated cost
  - estimated latency
  - policy result
  - benchmark-backed expected quality where available
```

Replay is initially simulation only and must not execute dangerous external actions.

## 15. Security requirements

- Never persist API keys, access tokens, cookies, authorization headers, or raw secrets.
- Tool permissions are evaluated server-side.
- High-risk actions fail closed when required authorization/policy is unavailable.
- Store redacted metadata rather than unnecessary sensitive payloads.
- Approval decisions are auditable.
- Replay is non-destructive by default.

## 16. MVP acceptance tests

### Test A — Decision Ledger
One real run produces an inspectable chain:

`intent → policy → evidence → decision → action → verification → evidence`

### Test B — Repair loop
A deterministic test fixture forces verification failure, then a bounded repair path succeeds:

`FAIL → REPAIR → VERIFY → COMPLETE`

### Test C — Hard stop
A run reaches `max_cost`, `max_iterations`, `max_runtime`, or `max_failures` and no subsequent model/tool action executes.

### Test D — Policy boundary
A high-risk action returns `ESCALATE`/`BLOCK` and the external action is not executed.

### Test E — Evidence feedback
The first execution creates measured evidence and a second similar task can consume that evidence without treating fixtures as measurements.

### Test F — Counterfactual safety
Replay changes policy/configuration in simulation without executing destructive actions.

## 17. Implementation order

1. Decision Ledger schema/events.
2. Hard stopping controls.
3. Closed-loop repair for one engineering workflow.
4. Verification evidence and completion gate.
5. Budget estimation/enforcement before model execution.
6. Counterfactual decision replay.
7. CEO/CTO decision timeline UI.

Do not broaden to generic swarm orchestration until these proofs are real and measured.
