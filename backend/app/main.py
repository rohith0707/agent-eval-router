from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .benchmark import load_cases
from .models import EvaluationRequest
from .registry import build_registry
from .router import route

app = FastAPI(title="Agent Eval Router", version="0.2.1")


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
    return {
        "task": request.task,
        "status": "passed" if decision.passed else "degraded",
        "decision": decision.model_dump(),
        "source": "fixture_profile_v0.1",
        "note": "Routing profiles are benchmark priors; use /v1/generate for live provider execution.",
    }


@app.post("/v1/generate")
async def generate(request: EvaluationRequest) -> dict:
    registry = build_registry()
    if not registry:
        raise HTTPException(503, "No real model provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or enable OLLAMA_ENABLED.")

    configured = [
        {
            "provider": adapter.provider,
            "model": adapter.name,
            "quality": 0.0,
            "latency_ms": 2_147_483_647,
            "cost": float("inf"),
            "reliability": 0.0,
        }
        for adapter in registry.values()
    ]
    # Live generation currently selects a configured provider deterministically.
    # Adaptive selection requires historical benchmark profiles; never fabricate live metrics.
    selected = next(iter(registry.values()))
    result = await selected.generate(request.task, max_tokens=request.max_tokens)
    return {
        "model": result.model,
        "provider": result.provider,
        "text": result.text,
        "latency_ms": result.latency_ms,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "cost": result.cost,
        "routing": {
            "mode": "configured_provider",
            "selected": result.model,
            "configured_candidates": configured,
        },
    }

from .models import ReplayRequest, ReplayResult, AgentRequest
from .replay import ReplayEngine
from .agent.graph import run_agent

@app.post("/v1/replay")
async def replay(request: ReplayRequest) -> ReplayResult:
    engine = ReplayEngine()
    return await engine.replay_route(
        task=request.task,
        task_type=request.task_type,
        constraints=request.constraints,
    )

@app.post("/v1/agent/run")
async def run_autonomous_agent(request: AgentRequest) -> dict:
    """Runs the autonomous agent, which routes automatically using its historical execution knowledge."""
    state = await run_agent(task=request.task, task_type=request.task_type)
    return {
        "status": state.get("status"),
        "task": state.get("task"),
        "task_type": state.get("task_type"),
        "provider": state.get("provider"),
        "model": state.get("model"),
        "quality": state.get("quality"),
        "latency_ms": state.get("latency_ms"),
        "cost_usd": state.get("cost_usd"),
        "output": state.get("output"),
        "trajectory": state.get("trajectory", []),
    }
