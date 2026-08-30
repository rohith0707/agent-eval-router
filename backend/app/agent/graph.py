from typing import Dict, Any
from .state import AgentState
from .nodes import plan_node, route_node, execute_node, evaluate_node, tool_node

def build_agent_graph():
    # Simple explicit workflow: Plan -> Route -> (maybe tool) -> Execute -> Evaluate
    return {
        "start": "plan",
        "nodes": {
            "plan": plan_node,
            "route": route_node,
            "tool": tool_node,
            "execute": execute_node,
            "evaluate": evaluate_node
        },
        "edges": {
            "plan": "route",
            "route": lambda s: "tool" if s["plan"].get("requires_tool") else "execute",
            "tool": "execute",
            "execute": "evaluate",
            "evaluate": "end"
        }
    }

async def run_agent(task: str, task_type: str = "auto") -> AgentState:
    graph = build_agent_graph()
    state = AgentState(task=task, task_type=task_type, status="running")
    
    # Run through graph sequentially
    node = graph["start"]
    while node != "end":
        func = graph["nodes"][node]
        state = await func(state)
        node = graph["edges"][node](state) if callable(graph["edges"][node]) else graph["edges"][node]
    
    state["status"] = "done"
    return state
