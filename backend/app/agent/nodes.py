"""Phase 4: LangGraph-style workflow nodes for the agent evaluation pipeline."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..router import DEFAULT_CANDIDATES, select_with_constraints
from ..models import ConstraintSet, AttemptRecord, TrajectoryStep

TASK_TYPES = {"reasoning", "rag", "tool_calling", "safety", "auto"}


def _classify_task(task: str) -> str:
    """Classify the task type from the NL task description."""
    task_lower = task.lower()
    if any(k in task_lower for k in ["retrieve", "search", "context", "document", "rag"]):
        return "rag"
    if any(k in task_lower for k in ["tool", "call", "execute", "function", "api"]):
        return "tool_calling"
    if any(k in task_lower for k in ["safety", "jailbreak", "injection", "harmful", "policy"]):
        return "safety"
    if any(k in task_lower for k in ["reason", "explain", "think", "analyze", "solve", "calculate"]):
        return "reasoning"
    return "auto"


async def plan_node(state: dict) -> dict:
    """Classify task type and build execution plan."""
    task = state.get("task", "")
    task_type = state.get("task_type", "auto")
    if task_type == "auto":
        task_type = _classify_task(task)

    plan = {
        "task_type": task_type,
        "requires_tool": task_type == "tool_calling",
        "max_steps": 3 if task_type == "tool_calling" else 1,
        "route_before_inference": True,
        "preferred_providers": [],
    }
    state["plan"] = plan
    state["trajectory"] = [
        *state.get("trajectory", []),
        {"step": "plan", "status": "done", "detail": f"task_type={task_type}"},
    ]
    return state


async def route_node(state: dict) -> dict:
    """Select the best provider/model using constraint-aware routing."""
    plan = state.get("plan", {})
    constraints = ConstraintSet(
        quality_floor=0.7,
        max_latency_ms=5000,
        max_cost_usd=0.01,
        reliability_floor=0.8,
    )
    decision = select_with_constraints(constraints, candidates=DEFAULT_CANDIDATES, evidence=[])
    state["provider"] = decision.selected.provider
    state["model"] = decision.selected.model
    state["trajectory"] = [
        *state.get("trajectory", []),
        {
            "step": "route",
            "status": "done",
            "detail": f"{decision.selected.provider}/{decision.selected.model}: {decision.reason}",
        },
    ]
    return state


async def tool_node(state: dict) -> dict:
    """Optional tool execution node (fires when plan.requires_tool is True)."""
    plan = state.get("plan", {})
    if not plan.get("requires_tool"):
        # Skip tool step if not required
        state["trajectory"] = [
            *state.get("trajectory", []),
            {"step": "tool", "status": "skipped", "detail": "no tool required for this task type"},
        ]
        return state

    task = state.get("task", "")
    # Mock tool: return a brief contextual augmentation
    tool_output = json.dumps({"context": f"Tool-augmented context for: {task[:80]}", "tool": "benchmark_analysis"})
    state["tool_calls"] = [
        *state.get("tool_calls", []),
        {"tool": "benchmark_analysis", "input_data": {"task": task}, "output": tool_output, "success": True},
    ]
    state["trajectory"] = [
        *state.get("trajectory", []),
        {"step": "tool", "status": "done", "detail": "benchmark_analysis tool executed"},
    ]
    return state


async def execute_node(state: dict) -> dict:
    """Mock execution node — records provider/model choice without calling a real API."""
    provider = state.get("provider") or "unknown"
    model = state.get("model") or "unknown"
    # In production this calls the real provider adapter; here we record a placeholder
    state["output"] = f"[mock] {provider}/{model} response for: {state.get('task', '')[:60]}"
    state["attempts"] = [
        *state.get("attempts", []),
        AttemptRecord(
            provider=provider,
            model=model,
            latency_ms=100,
            cost_usd=0.001,
            quality=0.85,
            status="passed",
        ).model_dump(),
    ]
    state["trajectory"] = [
        *state.get("trajectory", []),
        {"step": "execute", "status": "done", "detail": f"{provider}/{model} executed in ~100ms"},
    ]
    return state


async def evaluate_node(state: dict) -> dict:
    """Grade the output against the task. Uses lightweight deterministic heuristics."""
    task = state.get("task", "")
    output = state.get("output", "")
    attempts = state.get("attempts", [])
    if not attempts:
        state["status"] = "failed"
        state["failure_class"] = "infra_failed"
        return state
    last = attempts[-1]
    quality = last.get("quality", 0.0)
    state["quality"] = quality
    state["cost_usd"] = last.get("cost_usd", 0.0)
    state["latency_ms"] = last.get("latency_ms", 0)
    if quality < 0.5:
        state["status"] = "failed"
        state["failure_class"] = "quality_failure"
    else:
        state["status"] = "done"
    state["trajectory"] = [
        *state.get("trajectory", []),
        {
            "step": "evaluate",
            "status": "done",
            "detail": f"quality={quality:.3f}, status={state['status']}",
        },
    ]
    return state
