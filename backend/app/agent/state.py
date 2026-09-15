"""Typed state contract for the bounded autonomous decision loop."""
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
    decision: Optional[dict]
    decision_id: Optional[str]
    policy_version: Optional[str]
    decision_action: Optional[str]
    evidence_count: int
    max_cost_usd: float
    max_tokens: int
    max_iterations: int
    max_wall_time_ms: int
    max_failures: int
    total_cost_usd: float
    iteration: int
    loop_action: Optional[str]
    verification: dict
    ledger: list
    tool_context: Optional[str]
