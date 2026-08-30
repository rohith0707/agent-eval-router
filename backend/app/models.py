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

# ── Phase 3: Constraint-Aware Evidence-Driven Routing ────────────────────────

class ConstraintSet(BaseModel):
    quality_floor: float = Field(default=0.7, ge=0, le=1)
    max_latency_ms: int = Field(default=5000, gt=0)
    max_cost_usd: float = Field(default=0.01, ge=0)
    reliability_floor: float = Field(default=0.8, ge=0, le=1)

class EvidenceRow(BaseModel):
    task_type: str
    provider: str
    model: str
    quality: float = Field(ge=0, le=1)
    latency_ms: int = Field(ge=0)
    cost_usd: float = Field(ge=0)
    reliability: float = Field(ge=0, le=1)
    passed: bool

class ReplayResult(BaseModel):
    provider: str
    model: str
    rationale: str
    confidence_score: float = Field(ge=0, le=1)
    evidence_used: int = Field(ge=0)
    constraints: ConstraintSet

class ReplayRequest(BaseModel):
    task: str = Field(min_length=1)
    task_type: str = Field(default="auto")
    constraints: ConstraintSet = Field(default_factory=ConstraintSet)

# ── Phase 4: Agent State ─────────────────────────────────────────────────────

class AttemptRecord(BaseModel):
    provider: str
    model: str
    latency_ms: int
    cost_usd: float
    quality: float
    status: str

class ToolCall(BaseModel):
    tool: str
    input_data: dict
    output: str | None = None
    success: bool = True

class TrajectoryStep(BaseModel):
    step: str
    status: str
    detail: str | None = None

class AgentState(BaseModel):
    task: str
    task_type: str
    plan: dict = Field(default_factory=dict)
    provider: str | None = None
    model: str | None = None
    output: str | None = None
    quality: float | None = None
    cost_usd: float | None = None
    latency_ms: int | None = None
    attempts: list[AttemptRecord] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list)
    trajectory: list[TrajectoryStep] = Field(default_factory=list)
    status: str = "pending"
    failure_class: str | None = None

class AgentRequest(BaseModel):
    task: str = Field(min_length=1)
    task_type: str = Field(default="auto")
