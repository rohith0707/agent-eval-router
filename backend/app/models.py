from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    task: str = Field(min_length=1)
    quality_threshold: float = Field(default=0.90, ge=0, le=1)
    latency_budget_ms: int = Field(default=2500, gt=0)
    cost_budget: float = Field(default=0.03, ge=0)


class ModelCandidate(BaseModel):
    model: str
    quality: float
    latency_ms: int
    cost: float
    reliability: float


class RoutingDecision(BaseModel):
    selected: ModelCandidate
    eligible: list[ModelCandidate]
    passed: bool
    reason: str
