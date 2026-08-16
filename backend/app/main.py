from fastapi import FastAPI

from .models import EvaluationRequest
from .router import route

app = FastAPI(title="Agent Eval Router", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/evaluations")
async def evaluate(request: EvaluationRequest) -> dict:
    decision = route(
        request.quality_threshold,
        request.latency_budget_ms,
        request.cost_budget,
    )
    return {
        "task": request.task,
        "status": "passed" if decision.passed else "degraded",
        "decision": decision.model_dump(),
    }
