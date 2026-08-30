"""Phase 4: Agent state type for the LangGraph-style workflow."""
from __future__ import annotations
from typing import TypedDict, Optional

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
    attempts: list
    tool_calls: list
    trajectory: list
    status: str
    failure_class: Optional[str]
