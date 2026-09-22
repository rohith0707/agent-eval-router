# Python Evaluation Engine

The core of Agent Eval Router is Python-first. FastAPI exposes the evaluation API; routing, evaluation, adapters, benchmark execution, and observability belong in this service.

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[dev]'
uvicorn app.main:app --reload
```

## API

`GET /health`

`POST /v1/evaluations`

Example:

```json
{
  "task": "Return a structured comparison of two approaches",
  "quality_threshold": 0.9,
  "latency_budget_ms": 2500,
  "cost_budget": 0.03
}
```

The current candidates are deterministic v0.1 fixtures. Real provider adapters will implement the same interface before live benchmark claims are published.


## Live agent authorization

POST /v1/agent/run requires an authorization object with actor_id, principal_id, expires_at, and optionally the expected tool/action/resource/scope. The runtime derives the actual tool/action and evaluates them against server-side policy before execution. Unauthorized tools, parameter escalation, expired authorizations and excessive TTLs are blocked and recorded in the Decision Ledger.

Example authorization: { actor_id: "agent:researcher", principal_id: "user:123", expires_at: "2026-09-22T05:30:00Z", tool: "bounded_http", action: "execute" }
