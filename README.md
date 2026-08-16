# Agent Eval Router

**Python-first evaluation and routing infrastructure for production LLM and agent systems.**

> Decide which model or agent should run a task. Measure the outcome. Explain the decision. Turn failures into better evaluations.

Agent Eval Router is an engineering project focused on the layer between **model capability and product reliability**: routing, evaluation, failure analysis, observability, and cost/latency trade-offs.

---

## Why this project exists

A model that performs well in a demo can still fail in production because the task is wrong for the model, the context is incomplete, a tool fails, latency exceeds the budget, or cost grows faster than usage.

The project tests a simple product hypothesis:

> **Can adaptive model/agent routing produce a better quality–latency–cost trade-off than blindly sending every task to one model?**

The answer should come from reproducible evaluation data—not a benchmark number written in a README.

---

## Product architecture

```text
                         Evaluation Console
                              Next.js
                                 │
                                 ▼
                            FastAPI API
                                 │
                 ┌───────────────┼────────────────┐
                 ▼               ▼                ▼
              Router         Evaluator        Observability
                 │               │                │
        ┌────────┼────────┐      │          Trace / Metrics
        ▼        ▼        ▼      │
     OpenAI   Anthropic  Local   │
        │        │        │      │
        └────────┼────────┘      │
                 ▼               ▼
             Agent/Tool      Benchmark Suite
             Execution             │
                 │                 │
                 └────────┬────────┘
                          ▼
                 Decision + Evaluation
                          │
                          ▼
                    Run / Report Store
```

### Design principle

The **Python/FastAPI service is the source of truth for AI execution and evaluation**. The Next.js application is the product interface.

---

## Repository structure

```text
backend/
  app/
    main.py              # FastAPI entrypoint
    models.py            # Typed request/response contracts
    router.py            # Constraint-based routing
    adapters/            # Model provider adapters
    evaluation/          # Evaluation and scoring logic
    benchmark/           # Benchmark execution
    agents/              # Agent/tool execution
    observability/       # Tracing and metrics
  tests/
  pyproject.toml

app/                     # Next.js evaluation console
datasets/                # Versioned evaluation cases
docs/                    # Architecture and evaluation methodology
prisma/                  # Persistence schema
```

---

## Core workflow

```text
Task
  ↓
Task characteristics / requirements
  ↓
Routing policy
  ↓
Candidate filtering
  ↓
Model or agent execution
  ↓
Evaluation
  ├── Quality
  ├── Reliability
  ├── Latency
  ├── Cost
  └── Failure class
  ↓
Routing decision + trace
  ↓
Persist result
  ↓
Feed failures back into evaluation
```

The important part is the **feedback loop**: production failures should become evaluation cases, and evaluation should inform routing and system changes.

---

## What is implemented

- Python/FastAPI routing service
- Typed evaluation contracts with Pydantic
- Constraint-based routing using quality, latency, and cost budgets
- Deterministic fallback behavior when no candidate satisfies all constraints
- Provider-adapter architecture for OpenAI, Anthropic, and local models
- Benchmark dataset structure for reasoning, RAG, structured output, tool use, and agent planning
- Evaluation scoring primitives and failure categories
- Next.js evaluation console
- PostgreSQL/Prisma persistence foundation
- Docker and local development configuration
- CI checks for backend and frontend

### Current baseline

The repository currently contains **fixture values for v0.1** so the routing and UI can be exercised deterministically. They are intentionally not presented as live provider measurements.

---

## Evaluation methodology

Each benchmark case should define:

```json
{
  "id": "case-001",
  "category": "tool_calling",
  "difficulty": "medium",
  "task": "...",
  "expected_behavior": "...",
  "success_criteria": ["..."],
  "tools": []
}
```

A completed evaluation should capture:

- model / agent selected
- evaluator scores
- latency
- token usage
- cost
- reliability outcome
- failure class
- trace ID
- routing rationale

### Baselines that matter

The project is designed to compare:

**Single-model baseline**

vs.

**Adaptive routing**

The meaningful result is not “Model X scored 95%.” It is whether the routing strategy improves the overall product trade-off under explicit constraints.

---

## Engineering principles

### 1. Measure before optimizing

Quality is only one dimension. A routing decision that improves quality but doubles cost or breaks latency SLOs may be a worse product decision.

### 2. Prefer deterministic logic where it is sufficient

Not every workflow needs an autonomous agent. The system should make the smallest reliable decision that solves the task.

### 3. Treat evaluation as product infrastructure

Datasets, graders, regression cases, traces, and failure analysis belong beside application code—not in a spreadsheet after deployment.

### 4. Design for failure

Models return invalid outputs. Retrieval can miss context. Tools time out. Providers rate-limit. The system needs validation, retries, fallbacks, budgets, and observability.

### 5. Optimize for user outcomes

The objective is not a better benchmark chart. The objective is a more useful, reliable, and economically viable AI product.

---

## Local development

### Python engine

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
# Windows: .venv\Scripts\activate

pip install -e '.[dev]'
uvicorn app.main:app --reload
```

API:

```text
GET  /health
POST /v1/evaluations
```

Example:

```json
{
  "task": "Return a structured comparison of two approaches",
  "quality_threshold": 0.90,
  "latency_budget_ms": 2500,
  "cost_budget": 0.03
}
```

### Frontend

```bash
npm install
npm run dev
```

### Environment

Keep provider credentials local and out of Git:

```text
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=
DATABASE_URL=
```

---

## Roadmap

### v0.1 — Foundation

- [x] Python-first architecture
- [x] Explainable constraint-based routing
- [x] FastAPI API
- [x] Evaluation contracts
- [x] Benchmark dataset structure
- [x] Product console
- [x] Persistence foundation
- [x] CI foundation

### v0.2 — Real evaluations

- [ ] Execute 100+ benchmark cases against real providers
- [ ] OpenAI adapter in production path
- [ ] Anthropic adapter in production path
- [ ] Ollama/local adapter in production path
- [ ] Token and cost accounting
- [ ] Semantic / task-specific graders
- [ ] Failure taxonomy and drill-down
- [ ] Real run history in the console

### v0.3 — Production agent infrastructure

- [ ] Tool execution and agent trajectories
- [ ] OpenTelemetry traces
- [ ] Retry / timeout / idempotency policies
- [ ] Historical-performance-aware routing
- [ ] Adaptive routing
- [ ] Regression gates in CI
- [ ] Reproducible benchmark reports

---

## What makes this different from a typical LLM demo

This project is intentionally **not** centered on a chat UI or a single prompt chain.

It focuses on the system decisions that become difficult after deployment:

```text
Model selection
      +
Evaluation
      +
Failure analysis
      +
Latency
      +
Cost
      +
Reliability
      +
Observability
      ↓
Production AI behavior
```

---

## Engineering signal

This project is built around the same problems that current product-AI teams emphasize in production agent work: real-world agent execution, evaluation and regression coverage, production traces and failure analysis, model/tool trade-offs, reliability, and connecting technical changes to user outcomes. citeturn748788search0turn748788search1turn748788search2turn748788search6

---

## Author

**Rohith Balsa**  
AI Engineer focused on production LLM and agentic systems, evaluation, reliability, and AI infrastructure.

[LinkedIn](https://www.linkedin.com/in/rohithbalsa) · [GitHub](https://github.com/rohith0707)
