from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    task: str = Field(min_length=1)
    quality_threshold: float = Field(default=0.90, ge=0, le=1)
    latency_budget_ms: int = Field(default=2500, gt=0)
    cost_budget: float = Field(default=0.03, ge=0)
    max_tokens: int = Field(default=512, gt=0, le=8192)


class ModelCandidate(BaseModel):
    provider: str
    model: str
    quality: float = Field(ge=0, le=1)
    latency_ms: int = Field(ge=0)
    cost: float = Field(ge=0)
    reliability: float = Field(ge=0, le=1)


class RoutingDecision(BaseModel):
    selected: ModelCandidate
    eligible: list[ModelCandidate]
    passed: bool
    reason: str
