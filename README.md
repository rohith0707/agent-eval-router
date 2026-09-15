# Evidence-Driven Agent Control Plane

> **Agents can act autonomously. The control plane decides whether they should.**

Agent Eval Router is evolving into a runtime control plane for autonomous AI work. It sits between agent intent and model/tool execution and makes important actions **controllable, bounded, verifiable, and explainable**.

## The product

```text
Agent intent
    ↓
Risk + Policy + Budget
    ↓
Historical Evidence
    ↓
Decision
    ├── ROUTE
    ├── ALLOW
    ├── RETRY / FALLBACK
    ├── ESCALATE
    └── BLOCK
    ↓
Real execution
    ↓
Verification
    ↓
Decision Ledger
    ↓
COMPLETE / REPAIR / ABORT
```

The core primitive is not a swarm. It is the **Decision Ledger**: what the agent wanted to do, which policy applied, what evidence was used, what action was selected, what happened, and what proved the outcome.

## Why it is different

Generic multi-agent systems optimize agent collaboration. This project focuses on the control problem around autonomous work:

- **Policy:** what can happen?
- **Risk:** how much autonomy is acceptable?
- **Economics:** can the action stay inside its budget?
- **Reliability:** what happens when a model/tool fails?
- **Verification:** what evidence is required before declaring success?
- **Accountability:** why did the system act, retry, repair, escalate, or stop?

Multi-agent workers can be introduced for a bounded workflow, but they are an implementation detail—not the product promise.

## Current runtime capabilities

- deterministic pre-execution policy gate;
- risk-based `ALLOW | ROUTE | ESCALATE | BLOCK` decisions;
- configured real model adapters;
- bounded external HTTP tool;
- historical execution evidence;
- durable SQLite Decision Ledger for the current runtime;
- bounded retry/fallback;
- `FAIL → REPAIR → VERIFY → COMPLETE` loop;
- server-side max cost, iteration, wall-clock and failure limits;
- deterministic non-destructive counterfactual replay;
- `/v1/decisions` and `/v1/decisions/{decision_id}` inspection APIs;
- Next.js control-plane console.

## Run the backend

```bash
cd backend
# configure at least one provider: OPENAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_ENABLED=true
uvicorn app.main:app --reload
```

### Live run

```bash
curl -X POST http://localhost:8000/v1/agent/run \
  -H 'content-type: application/json' \
  -d '{
    "task": "Explain the failing CI test and produce a verified repair plan",
    "task_type": "coding",
    "max_cost_usd": 0.05,
    "max_tokens": 512,
    "max_iterations": 3,
    "max_wall_time_ms": 120000,
    "max_failures": 2
  }'
```

### Inspect decisions

```bash
curl http://localhost:8000/v1/decisions
curl http://localhost:8000/v1/decisions/<decision_id>
```

### Counterfactual replay

```bash
curl -X POST http://localhost:8000/v1/replay \
  -H 'content-type: application/json' \
  -d '{"task":"choose a model for this coding task","task_type":"coding"}'
```

Replay is simulation only. It does not execute external actions.

## Provenance

Runtime metrics are labeled as measured only when they come from actual execution. Fixture/demo/synthetic values must never be presented as production measurements.

The current durable runtime evidence implementation is **SQLite**, not PostgreSQL. PostgreSQL remains a future durability target; do not claim it is implemented until the repository actually uses it.

## Architecture

- **Backend:** Python / FastAPI
- **Runtime:** policy → evidence → decision → execution → verification → ledger
- **Frontend:** Next.js App Router
- **Provider boundary:** isolated model adapters
- **Evidence:** current SQLite execution history + Decision Ledger
- **CI:** GitHub Actions

## Scope guard

This is deliberately not a generic agent swarm framework, RAG platform, enterprise IAM suite, or Kubernetes control plane. The near-term goal is one spectacular, verifiable autonomous engineering workflow and the runtime decision primitives underneath it.

---

*Designed and engineered by Rohith Balsa for high-reliability autonomous AI systems.*
