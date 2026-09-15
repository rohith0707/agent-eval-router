"""Run the real agent path against a bounded benchmark and emit provenance-rich JSON.

Usage:
    python scripts/run_live_benchmark.py --limit 15 --output ../benchmark/results/live-agent.json
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from time import perf_counter

from app.agent.graph import run_agent
from app.benchmark import load_cases


async def run(limit: int) -> dict:
    cases = load_cases()[:limit]
    results = []
    started = perf_counter()
    for case in cases:
        run_started = perf_counter()
        state = await run_agent(task=case["prompt"], task_type=case.get("category", "auto"))
        results.append({
            "id": case["id"],
            "category": case.get("category"),
            "status": state.get("status"),
            "provider": state.get("provider"),
            "model": state.get("model"),
            "quality": state.get("quality"),
            "latency_ms": state.get("latency_ms"),
            "cost_usd": state.get("cost_usd"),
            "decision_id": state.get("decision_id"),
            "decision_action": state.get("decision_action"),
            "evidence_count": state.get("evidence_count", 0),
            "failure_class": state.get("failure_class"),
            "elapsed_wall_ms": int((perf_counter() - run_started) * 1000),
        })

    completed = [r for r in results if r["status"] == "done"]
    return {
        "provenance": "MEASURED_LIVE_AGENT_RUN",
        "cases": len(results),
        "completed": len(completed),
        "completion_rate": len(completed) / len(results) if results else 0.0,
        "avg_quality": sum(r["quality"] or 0 for r in completed) / len(completed) if completed else 0.0,
        "avg_latency_ms": sum(r["latency_ms"] or 0 for r in completed) / len(completed) if completed else 0.0,
        "total_cost_usd": sum(r["cost_usd"] or 0 for r in results),
        "wall_time_ms": int((perf_counter() - started) * 1000),
        "results": results,
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--output", default="../benchmark/results/live-agent.json")
    args = parser.parse_args()
    report = await run(max(1, min(args.limit, 50)))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
