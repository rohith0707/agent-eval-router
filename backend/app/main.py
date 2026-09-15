from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .benchmark import load_cases
from .models import EvaluationRequest, ReplayRequest, ReplayResult, AgentRequest
from .registry import build_registry
from .router import route
from .replay import ReplayEngine
from .agent.graph import run_agent
from .agent.history import history_store

app = FastAPI(title="Evidence-Driven Agent Control Plane", version="0.4.0")


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
    return {"task": request.task, "status": "passed" if decision.passed else "degraded",
            "decision": decision.model_dump(), "source": "fixture_profile_v0.1",
            "note": "Offline fixture routing. Use /v1/agent/run for the live control-plane path."}


@app.post("/v1/generate")
async def generate(request: EvaluationRequest) -> dict:
    registry = build_registry()
    if not registry:
        raise HTTPException(503, "No real model provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or enable OLLAMA_ENABLED.")
    selected = next(iter(registry.values()))
    result = await selected.generate(request.task, max_tokens=request.max_tokens)
    return {"model": result.model, "provider": result.provider, "text": result.text,
            "latency_ms": result.latency_ms, "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens, "cost": result.cost,
            "routing": {"mode": "configured_provider", "selected": result.model}}


@app.post("/v1/replay")
async def replay(request: ReplayRequest) -> ReplayResult:
    evidence = history_store.get_evidence(request.task_type)
    actual = history_store.get_decision(request.decision_id) if request.decision_id else None
    engine = ReplayEngine()
    return await engine.replay_route(task=request.task, task_type=request.task_type,
                                     constraints=request.constraints, evidence=evidence,
                                     alternative_constraints=request.alternative_constraints,
                                     actual=actual)


@app.get("/v1/decisions")
async def decisions(limit: int = 50) -> dict:
    return {"decisions": history_store.list_decisions(max(1, min(limit, 200))), "provenance": "MEASURED_RUNTIME_LEDGER"}


@app.get("/v1/decisions/{decision_id}")
async def decision_detail(decision_id: str) -> dict:
    decision = history_store.get_decision(decision_id)
    if not decision:
        raise HTTPException(404, "Decision not found")
    return {"decision": decision, "provenance": "MEASURED_RUNTIME_LEDGER"}


@app.post("/v1/agent/run")
async def run_autonomous_agent(request: AgentRequest) -> dict:
    state = await run_agent(task=request.task, task_type=request.task_type,
                            max_cost_usd=request.max_cost_usd, max_tokens=request.max_tokens,
                            max_iterations=request.max_iterations, max_wall_time_ms=request.max_wall_time_ms,
                            max_failures=request.max_failures)
    return {
        "run_id": state.get("run_id"), "status": state.get("status"), "task": state.get("task"),
        "task_type": state.get("task_type"), "provider": state.get("provider"), "model": state.get("model"),
        "quality": state.get("quality"), "latency_ms": state.get("latency_ms"), "cost_usd": state.get("cost_usd"),
        "total_cost_usd": state.get("total_cost_usd", 0.0), "output": state.get("output"),
        "decision_id": state.get("decision_id"), "decision_action": state.get("decision_action"),
        "loop_action": state.get("loop_action"), "iteration": state.get("iteration", 0),
        "policy_version": state.get("policy_version"), "decision": state.get("decision"),
        "verification": state.get("verification", {}), "evidence_count": state.get("evidence_count", 0),
        "failure_class": state.get("failure_class"), "tool_calls": state.get("tool_calls", []),
        "trajectory": state.get("trajectory", []), "limits": {
            "max_cost_usd": request.max_cost_usd, "max_iterations": request.max_iterations,
            "max_wall_time_ms": request.max_wall_time_ms, "max_failures": request.max_failures,
        },
    }
