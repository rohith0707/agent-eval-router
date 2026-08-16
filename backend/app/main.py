from fastapi import FastAPI, HTTPException

from .benchmark import load_cases
from .models import EvaluationRequest
from .registry import build_registry
from .router import route

app = FastAPI(title="Agent Eval Router", version="0.2.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/models")
async def models() -> dict:
    registry = build_registry()
    return {"configured": [{"provider": a.provider, "model": a.name} for a in registry.values()]}


@app.get("/v1/benchmarks")
async def benchmarks() -> dict:
    cases = load_cases()
    return {"version": "v1", "total": len(cases), "categories": sorted({c["category"] for c in cases}), "cases": cases}


@app.post("/v1/evaluations")
async def evaluate(request: EvaluationRequest) -> dict:
    decision = route(request.quality_threshold, request.latency_budget_ms, request.cost_budget)
    return {"task": request.task, "status": "passed" if decision.passed else "degraded", "decision": decision.model_dump()}


@app.post("/v1/generate")
async def generate(request: EvaluationRequest) -> dict:
    registry = build_registry()
    if not registry:
        raise HTTPException(503, "No real model provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or enable OLLAMA_ENABLED.")
    adapter = next(iter(registry.values()))
    result = await adapter.generate(request.task, max_tokens=request.max_tokens)
    return {"model": result.model, "provider": result.provider, "text": result.text, "latency_ms": result.latency_ms, "input_tokens": result.input_tokens, "output_tokens": result.output_tokens, "cost": result.cost}
