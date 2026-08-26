# Adaptive AI Agent Evaluation

**An evaluation-driven AI system for building, testing, and improving LLM and agent workflows.**

> Give it a real product task. It chooses a viable AI strategy, measures the outcome, explains failures, and turns repeated failures into better tests.

## Why this exists

Most AI prototypes stop at “the model answered.” Production AI needs a harder loop:

```text
Product task
    ↓
AI strategy
    ↓
Model / retrieval / tool execution
    ↓
Task-specific evaluation
    ↓
Failure analysis
    ↓
Routing or prompt improvement
    ↓
Regression case
    ↓
CI + production
```

This project is built around that loop.

## Product-engineering focus

The project is intentionally positioned as an **AI Engineer** project rather than a model-provider dashboard.

It demonstrates:

- LLM application development
- agent workflows and tool use
- RAG-oriented evaluation
- structured outputs and text-to-SQL
- task-aware model selection
- quality and safety evaluation
- latency and token/cost measurement
- provider failure recovery
- regression testing
- reproducible evidence for AI decisions

The provider gateway, fallback logic, and APIM-ready controls are implementation details that make the AI workflow production-safe; they are not the product story.

## Core workflow

```text
User task
   ↓
Task characteristics
   ├─ reasoning
   ├─ RAG
   ├─ structured output
   ├─ SQL
   ├─ tool use
   └─ agent planning
   ↓
Candidate AI strategies
   ├─ fast / cheap model
   ├─ reasoning model
   ├─ long-context model
   └─ agentic strategy
   ↓
Execution
   ↓
Independent evaluation
   ├─ correctness
   ├─ groundedness
   ├─ structure
   ├─ tool behavior
   ├─ safety
   └─ task completion
   ↓
Decision + evidence
   ↓
Failure → regression case
```

## What makes the project useful

### 1. Product AI Lab

The live workspace lets you test realistic tasks such as:

- production incident investigation
- RAG reliability review
- safe text-to-SQL
- agent planning

The user does not manually pick a model. The system owns the strategy decision and records the evidence.

### 2. Fixed 50-case evaluation suite

The benchmark covers:

```text
reasoning
structured output
tool calling
RAG
agent planning
reliability
text-to-SQL
safety / injection
code generation
regression
```

The suite deliberately separates:

```text
model-quality failure
        ≠
infrastructure/provider failure
```

so a timeout or rate limit cannot be presented as a bad model score.

### 3. Cost-aware and reliability-aware routing

The runtime prefers inexpensive viable candidates, but it does not treat “cheapest” as “always best.” It considers capability, reliability, latency, and failure state, then falls back when a provider or model is unhealthy.

### 4. Hard-task escalation

Long-horizon work can be escalated to a stronger reasoning path such as **Ox Alpha via OpenRouter**, while ordinary tasks remain on cheaper candidates.

The goal is not to spend the expensive model on every request. The goal is to use it when the task justifies it.

### 5. Evidence for every decision

A run records the signals needed to answer:

> Why did the system choose this model strategy?

Evidence can include:

- selected model/provider
- fallback attempts
- latency
- input/output/reasoning tokens when available
- estimated cost
- evaluation result
- routing rationale
- execution trace
- persistence status

## Architecture

```text
                         Product AI Lab
                              Next.js
                                 │
                                 ▼
                           AI Application API
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        Task strategy        Evaluation         Evidence
              │                  │                  │
              └────────────┬─────┴──────────────────┘
                           ▼
                  Model / Agent execution
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
       Gemini            HF/NVIDIA       OpenRouter
                                             │
                                    DeepSeek / Ox Alpha
                           │
                           ▼
                  Result + failure class
                           │
                           ▼
                    Neon / PostgreSQL
```

## AI-engineering evidence

A strong run should answer five questions:

1. What user problem was solved?
2. Why was a simple single-model call insufficient?
3. What did the AI system actually do?
4. How was success measured?
5. What changed after the failures were analyzed?

That is the standard used for the project's engineering decisions.

## Recommended portfolio result

The most important result is **not** “Model X scored 95%.”

The meaningful comparison is:

```text
Fixed baseline
vs
Cheapest viable strategy
vs
Adaptive AI strategy
```

Compare them on the same cases using:

```text
Task success
p95 latency
Cost / successful task
Infrastructure availability
Fallback rate
```

Only real run data belongs in the README.

## Reliability model

The provider layer distinguishes failures such as:

```text
401 / 403     credential or permission failure
404           model/endpoint mismatch
429           rate limit
5xx           provider-side failure
timeout       deadline exceeded
transport     network/connection failure
empty         unusable model response
```

Operational failures are kept separate from model quality.

## Development

### Frontend

```bash
npm install
npm run dev
```

### Verification gate

```bash
npm run typecheck
npm run validate:production-contract
npm run validate:benchmark
npm run build

cd backend
python -m pytest
```

No code change should be considered production-ready until the applicable checks pass.

## Configuration

Provider secrets stay server-side and out of source control.

Canonical variables include:

```text
GEMINI_API_KEY=
HF_TOKEN=
NVIDIA_API_KEY=
OPENROUTER_API_KEY=
DATABASE_URL=
```

Legacy deployment aliases are supported by the runtime configuration resolver where required.

## What is intentionally not the main story

This project contains:

- API management controls
- rate limiting
- provider fallback
- model registry
- persistence
- deployment infrastructure

These support the AI workflow, but the portfolio narrative is **AI application quality and improvement**, not platform administration.


## Author

**Rohith Balsa**  
AI Engineer focused on LLM applications, agents, evaluation, reliability, and applied AI systems.

[GitHub](https://github.com/rohith0707)
