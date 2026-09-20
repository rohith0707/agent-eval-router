"""Bounded control-plane workflow with repair and hard stop decisions."""
from __future__ import annotations

from time import monotonic
from .state import AgentState
from .nodes import plan_node, route_node, execute_node, evaluate_node, tool_node
from .history import history_store


def build_agent_graph():
    return {"start": "plan", "nodes": {"plan": plan_node, "route": route_node, "tool": tool_node, "execute": execute_node, "evaluate": evaluate_node},
            "edges": {"plan": "route", "route": lambda s: "tool" if s.get("plan", {}).get("requires_tool") else "execute", "tool": "execute", "execute": "evaluate", "evaluate": "end"}}


def _append(state: dict, step: str, status: str, detail: str) -> None:
    state.setdefault("trajectory", []).append({"step": step, "status": status, "detail": detail, "iteration": state.get("iteration", 0)})


def _should_stop(state: dict, started: float) -> tuple[bool, str]:
    if state.get("total_cost_usd", 0.0) >= state.get("max_cost_usd", 0.01): return True, "max_cost_exceeded"
    if state.get("iteration", 0) >= state.get("max_iterations", 3): return True, "max_iterations_exceeded"
    if (monotonic() - started) * 1000 >= state.get("max_wall_time_ms", 120_000): return True, "max_wall_time_exceeded"
    if sum(1 for a in state.get("attempts", []) if a.get("status") in {"quality_failed", "failed"}) > state.get("max_failures", 2): return True, "max_failures_exceeded"
    return False, ""


async def run_agent(task: str, task_type: str = "auto", max_cost_usd: float = 0.01, max_tokens: int = 512,
                    max_iterations: int = 3, max_wall_time_ms: int = 120_000, max_failures: int = 2,
                    quality_threshold: float = 0.7) -> AgentState:
    run_id = __import__("uuid").uuid4().hex
    state: AgentState = AgentState(task=task, task_type=task_type, status="running")
    state.update({"run_id": run_id, "max_cost_usd": max_cost_usd, "max_tokens": max_tokens, "max_iterations": max_iterations,
                  "max_wall_time_ms": max_wall_time_ms, "max_failures": max_failures, "quality_threshold": quality_threshold,
                  "total_cost_usd": 0.0, "iteration": 0, "attempts": [], "tool_calls": [], "trajectory": []})
    started = monotonic()
    await plan_node(state)

    while state.get("iteration", 0) < max_iterations:
        stop, reason = _should_stop(state, started)
        if stop:
            state["status"] = "aborted"; state["loop_action"] = "ABORT"; _append(state, "loop", "aborted", reason)
            history_store.record_decision(state, action="ABORT", outcome=reason); break

        state["iteration"] += 1; state["status"] = "running"; state["failure_class"] = None
        _append(state, "loop", "started", f"iteration={state['iteration']}")
        await route_node(state)
        if state.get("status") in {"blocked", "escalated"}: break
        await tool_node(state); await execute_node(state); await evaluate_node(state)

        # Budget is a server-side invariant: a successful answer cannot bypass it.
        if state.get("total_cost_usd", 0.0) >= max_cost_usd:
            state["status"] = "aborted"; state["loop_action"] = "ABORT"; _append(state, "loop", "aborted", "max_cost_exceeded")
            history_store.record_decision(state, action="ABORT", outcome="max_cost_exceeded"); break

        if state.get("status") == "done":
            state["loop_action"] = "COMPLETE"; _append(state, "loop", "complete", "independent verification gate passed")
            history_store.record_decision(state, action="COMPLETE", outcome="verified"); break

        if state.get("failure_class") == "verification_incomplete":
            state["status"] = "escalated"
            state["loop_action"] = "ESCALATE"
            _append(state, "loop", "escalated", "verification evidence is insufficient for completion")
            history_store.record_decision(state, action="ESCALATE", outcome="verification_incomplete")
            break

        failures = sum(1 for a in state.get("attempts", []) if a.get("status") in {"quality_failed", "failed"})
        if failures <= max_failures and state.get("iteration", 0) < max_iterations:
            state["loop_action"] = "REPAIR"
            state["task"] = task + "\n\nRepair the previous attempt. Address the verification failures and return a more complete, testable result."
            _append(state, "loop", "repair", f"verification failed; failures={failures}")
            history_store.record_decision(state, action="REPAIR", outcome="continue")
            continue
        state["loop_action"] = "ABORT"; state["status"] = "aborted"; _append(state, "loop", "stopped", "repair limits exhausted")
        break

    if state.get("status") == "running":
        state["status"] = "aborted"; state["loop_action"] = "ABORT"; _append(state, "loop", "aborted", "loop exhausted")
    return state
