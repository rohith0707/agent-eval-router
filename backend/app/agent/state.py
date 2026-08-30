class AgentState(TypedDict, total=False):
    task: str
    task_type: str
    plan: dict
    provider: str | None
    model: str | None
    output: str | None
    quality: float | None
    cost_usd: float | None
    latency_ms: int | None
    attempts: list[AttemptRecord]
    tool_calls: list[ToolCall]
    trajectory: list[TrajectoryStep]
    status: str
    failure_class: str | None
