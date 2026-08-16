# Agent Eval Router

**Python-first evaluation and routing infrastructure for LLM and agent workloads.**

Agent Eval Router explores a production question: **given a task and explicit quality, latency, and cost constraints, which model or agent should run it — and can we measure and explain that decision?**

## Architecture

```text
                    Evaluation Console
                         Next.js
                            │
                            ▼
                       FastAPI API
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           Router       Evaluator      Tracing
              │             │             │
        ┌─────┼─────┐       │             │
        ▼     ▼     ▼       │             │
      OpenAI Claude Local   │             │
        │     │     │       │             │
        └─────┼─────┘       │             │
              ▼             ▼             ▼
             Agent      Benchmark      Run Store
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                     Decision + Report
```

## Repository structure

```text
backend/     Python/FastAPI core: routing, evaluation, adapters and benchmarks
app/         Next.js evaluation console
prisma/      PostgreSQL persistence schema
docs/        Evaluation methodology and architecture
```

The Python service is the **source of truth for AI execution and evaluation**. The Next.js application is the presentation layer.

## Python engine

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e '.[dev]'
uvicorn app.main:app --reload
```

API:

- `GET /health`
- `POST /v1/evaluations`

Example request:

```json
{
  "task": "Return a structured comparison of two approaches",
  "quality_threshold": 0.90,
  "latency_budget_ms": 2500,
  "cost_budget": 0.03
}
```

## Current status

### Implemented

- Python-first routing engine
- FastAPI evaluation API
- typed routing domain models
- constraint-based model selection
- deterministic fallback behavior
- Next.js evaluation console
- PostgreSQL/Prisma persistence foundation
- evaluation methodology
- CI foundation

### In progress

- Real OpenAI / Anthropic / local model adapters
- 100+ case benchmark execution
- semantic and task-specific evaluators
- agent/tool execution
- failure taxonomy and drill-down
- OpenTelemetry traces
- adaptive routing from historical results
- regression gates in CI

Current model metrics are **v0.1 fixture values**, not live provider measurements.

## Engineering thesis

An LLM call is only one component of a production AI system. Model choice must be evaluated against task quality, latency, cost, reliability, and failure modes.

The long-term goal is to compare **single-model baselines against adaptive routing** and determine whether routing can improve the quality/cost/latency trade-off without increasing reliability failures.
