import pytest

from app.agent import graph


@pytest.mark.asyncio
async def test_run_agent_aborts_when_budget_is_exhausted(monkeypatch):
    async def plan(state):
        return state

    async def route(state):
        return state

    async def tool(state):
        return state

    async def execute(state):
        state["total_cost_usd"] = 0.02
        state["cost_usd"] = 0.02
        return state

    async def evaluate(state):
        raise AssertionError("evaluation must not run after a hard budget breach")

    monkeypatch.setattr(graph, "plan_node", plan)
    monkeypatch.setattr(graph, "route_node", route)
    monkeypatch.setattr(graph, "tool_node", tool)
    monkeypatch.setattr(graph, "execute_node", execute)
    monkeypatch.setattr(graph, "evaluate_node", evaluate)
    monkeypatch.setattr(graph.history_store, "record_decision", lambda *args, **kwargs: None)

    state = await graph.run_agent(
        "budget test",
        max_cost_usd=0.01,
        max_iterations=3,
        max_wall_time_ms=10_000,
        max_failures=2,
    )

    assert state["status"] == "aborted"
    assert state["loop_action"] == "ABORT"
    assert state["trajectory"][-1]["detail"] == "max_cost_exceeded"


@pytest.mark.asyncio
async def test_run_agent_escalates_when_verification_is_incomplete(monkeypatch):
    async def plan(state):
        return state

    async def route(state):
        return state

    async def tool(state):
        return state

    async def execute(state):
        state.setdefault("attempts", []).append({"status": "completed"})
        state["output"] = "candidate"
        return state

    async def evaluate(state):
        state["status"] = "failed"
        state["failure_class"] = "verification_incomplete"
        return state

    monkeypatch.setattr(graph, "plan_node", plan)
    monkeypatch.setattr(graph, "route_node", route)
    monkeypatch.setattr(graph, "tool_node", tool)
    monkeypatch.setattr(graph, "execute_node", execute)
    monkeypatch.setattr(graph, "evaluate_node", evaluate)
    monkeypatch.setattr(graph.history_store, "record_decision", lambda *args, **kwargs: None)

    state = await graph.run_agent(
        "verification test",
        max_cost_usd=0.05,
        max_iterations=3,
        max_wall_time_ms=10_000,
        max_failures=2,
    )

    assert state["status"] == "escalated"
    assert state["loop_action"] == "ESCALATE"
    assert any(event["status"] == "escalated" for event in state["trajectory"])


@pytest.mark.asyncio
async def test_run_agent_repairs_then_completes_after_verification(monkeypatch):
    async def plan(state):
        return state

    async def route(state):
        return state

    async def tool(state):
        return state

    async def execute(state):
        state.setdefault("attempts", []).append({"status": "completed"})
        state["output"] = "candidate"
        return state

    async def evaluate(state):
        if state["iteration"] == 1:
            state["status"] = "failed"
            state["failure_class"] = "verification_incomplete"
        else:
            state["status"] = "done"
            state["verification"] = {"passed": True, "provenance": "LIVE_INDEPENDENT_VERIFIER"}
        return state

    monkeypatch.setattr(graph, "plan_node", plan)
    monkeypatch.setattr(graph, "route_node", route)
    monkeypatch.setattr(graph, "tool_node", tool)
    monkeypatch.setattr(graph, "execute_node", execute)
    monkeypatch.setattr(graph, "evaluate_node", evaluate)
    monkeypatch.setattr(graph.history_store, "record_decision", lambda *args, **kwargs: None)

    state = await graph.run_agent(
        "repair test",
        max_cost_usd=0.05,
        max_iterations=3,
        max_wall_time_ms=10_000,
        max_failures=2,
    )

    assert state["status"] == "done"
    assert state["loop_action"] == "COMPLETE"
    assert state["iteration"] == 2
    assert any(event["status"] == "repair" for event in state["trajectory"])
    assert state["verification"]["passed"] is True
