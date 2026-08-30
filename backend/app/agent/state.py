"""Agent state types for the workflow (reuses pydantic models in app.models)."""
from __future__ import annotations

from typing import Optional, TypedDict

# ponytail: AgentState re-uses the pydantic models already defined in app.models.
# We only declare the TypedDict here so the graph can carry a runtime-friendly state.
class AgentState(TypedDict, total=False):
    task: str
    task_type: str
    plan: dict
    provider: Optional[str]
    model: Optional[str]
    output: Optional[str]
    quality: Optional[float]
    cost_usd: Optional[float]
    latency_ms: Optional[int]
    attempts: list  # list[AttemptRecord.model_dump()] (dicts for TypedDict)
    tool_calls: list
    trajectory: list
    status: str
    failure_class: Optional[str]
