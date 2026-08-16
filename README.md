# Agent Eval Router

**Benchmark-driven routing and evaluation for LLM workloads.**

Agent Eval Router explores a practical production question: **given a task and explicit quality, latency, and cost constraints, which model or agent should run it — and can we explain and measure that decision?**

## Product

The repository includes a Next.js evaluation console and a routing engine with:

- model candidate scoring
- quality / latency / cost constraints
- explainable routing decisions
- fallback selection
- evaluation run persistence with Prisma/PostgreSQL
- execution traces
- benchmark-oriented model scorecards

## Architecture

```text
Task
  ↓
Routing Policy
  ↓
Candidate Filtering
  ↓
Model / Agent Execution
  ↓
Evaluation
  ├── Quality
  ├── Latency
  ├── Cost
  └── Reliability
  ↓
Decision + Trace
  ↓
Evaluation Console
```

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

For persistence, set `DATABASE_URL` to a PostgreSQL database and run:

```bash
npx prisma generate
npx prisma db push
```

The API remains usable without a configured database; evaluation responses are returned with `persisted: false` when persistence is unavailable.

## Current v0.1 baseline

| Model | Quality | p95 latency | Cost / task | Reliability |
|---|---:|---:|---:|---:|
| GPT-5 | 91.8% | 1.42s | $0.014 | 96.2% |
| Claude Sonnet | 95.2% | 1.88s | $0.021 | 97.1% |
| Local Llama | 87.4% | 0.76s | $0.002 | 91.4% |

These are **baseline fixture values for v0.1**, not claims of live provider measurements.

## Roadmap

- [x] Explainable constraint-based routing
- [x] Evaluation API
- [x] Persistent run schema
- [x] Evaluation console
- [ ] Real OpenAI / Anthropic / local model adapters
- [ ] Real 100+ case benchmark execution
- [ ] Semantic and task-specific evaluators
- [ ] Failure taxonomy and drill-down
- [ ] OpenTelemetry traces
- [ ] Adaptive routing from historical results
- [ ] Regression gates in CI

## Why this project exists

An LLM call is not a production AI system. Routing, evaluation, failure handling, observability, latency, and cost all influence whether a model choice is actually good.

This project is an engineering exploration of those decisions, with benchmarks and methodology treated as first-class product artifacts.
