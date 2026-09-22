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
    actual: dict | None = None
    counterfactual: dict | None = None
    delta: dict | None = None


class ReplayRequest(BaseModel):
    task: str = Field(min_length=1)
    task_type: str = Field(default="auto")
    constraints: ConstraintSet = Field(default_factory=ConstraintSet)
    alternative_constraints: ConstraintSet | None = None
    decision_id: str | None = None


class AttemptRecord(BaseModel):
    provider: str
    model: str
    latency_ms: int = Field(ge=0)
    cost_usd: float = Field(ge=0)
    quality: float = Field(default=0.0, ge=0, le=1)
    status: str
    failure_class: str | None = None


class ToolCall(BaseModel):
    tool: str
    input_data: dict
    output: str | None = None
    success: bool = True
    latency_ms: int | None = None
    failure_class: str | None = None


class TrajectoryStep(BaseModel):
    step: str
    status: str
    detail: str | None = None
    iteration: int | None = None


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
    decision: dict | None = None
    decision_id: str | None = None
    policy_version: str | None = None
    decision_action: str | None = None
    evidence_count: int = 0
    max_cost_usd: float = Field(default=0.01, ge=0)
    max_tokens: int = Field(default=512, gt=0, le=8192)
    max_iterations: int = Field(default=3, ge=1, le=10)
    max_wall_time_ms: int = Field(default=120_000, gt=0)
    max_failures: int = Field(default=2, ge=0, le=10)
    authorization: AgentAuthorization
    total_cost_usd: float = 0.0
    iteration: int = 0
    loop_action: str | None = None
    verification: dict = Field(default_factory=dict)
    ledger: list[dict] = Field(default_factory=list)


class AgentAuthorization(BaseModel):
    actor_id: str = Field(min_length=1)
    principal_id: str = Field(min_length=1)
    expires_at: str = Field(min_length=1)
    tool: str | None = None
    action: str | None = None
    resource: str = ""
    scope: str | None = None


class AgentRequest(BaseModel):
    task: str = Field(min_length=1)
    task_type: str = Field(default="auto")
    max_cost_usd: float = Field(default=0.01, ge=0)
    max_tokens: int = Field(default=512, gt=0, le=8192)
    max_iterations: int = Field(default=3, ge=1, le=10)
    max_wall_time_ms: int = Field(default=120_000, gt=0)
    max_failures: int = Field(default=2, ge=0, le=10)
