"""Bounded live benchmark with auditable grading and percentile metrics."""
from __future__ import annotations
import argparse, asyncio, json, statistics
from pathlib import Path
from time import perf_counter
from app.agent.graph import run_agent
from app.benchmark import load_cases
from app.evaluation import evaluate_text

def percentile(values: list[float], p: float) -> float:
    if not values: return 0.0
    ordered=sorted(values)
    return ordered[min(len(ordered)-1,max(0,int((len(ordered)-1)*p)))]

def grade(case: dict, state: dict) -> dict:
    score=evaluate_text(state.get("output") or "", case.get("expected"), case.get("required_terms"))
    return {"passed":bool(score.passed),"correctness":score.correctness,"relevance":score.relevance,"failure_type":score.failure_type}

async def run(limit:int)->dict:
    cases=load_cases()[:limit]; results=[]; started=perf_counter()
    for case in cases:
        t=perf_counter()
        state=await run_agent(task=case["task"],task_type=case.get("category","auto"),max_cost_usd=0.05,max_tokens=512,max_iterations=3,max_wall_time_ms=120000,max_failures=2)
        results.append({"id":case["id"],"category":case.get("category"),"status":state.get("status"),"provider":state.get("provider"),"model":state.get("model"),"quality":state.get("quality"),"latency_ms":state.get("latency_ms"),"cost_usd":state.get("cost_usd"),"decision_id":state.get("decision_id"),"decision_action":state.get("decision_action"),"evidence_count":state.get("evidence_count",0),"failure_class":state.get("failure_class"),"grading":grade(case,state),"iterations":state.get("iteration",0),"elapsed_wall_ms":int((perf_counter()-t)*1000)})
    passed=[r for r in results if r["grading"]["passed"]]; lat=[r["elapsed_wall_ms"] for r in results]; costs=[r["cost_usd"] or 0 for r in results]
    by_category={}
    for cat in sorted({r["category"] for r in results}):
        rows=[r for r in results if r["category"]==cat]
        by_category[cat]={"cases":len(rows),"passed":sum(r["grading"]["passed"] for r in rows),"pass_rate":sum(r["grading"]["passed"] for r in rows)/len(rows),"avg_cost_usd":sum(r["cost_usd"] or 0 for r in rows)/len(rows),"p95_latency_ms":percentile([r["elapsed_wall_ms"] for r in rows],.95)}
    return {"provenance":"MEASURED_LIVE_AGENT_RUN","benchmark_version":"routing-bench-v1","cases":len(results),"completed":sum(r["status"]=="done" for r in results),"passed":len(passed),"pass_rate":len(passed)/len(results) if results else 0.0,"completion_rate":sum(r["status"]=="done" for r in results)/len(results) if results else 0.0,"avg_quality":statistics.mean([r["quality"] or 0 for r in results]) if results else 0.0,"p50_latency_ms":percentile(lat,.50),"p95_latency_ms":percentile(lat,.95),"total_cost_usd":sum(costs),"cost_per_passed_task_usd":sum(costs)/len(passed) if passed else 0.0,"repair_rate":sum(r["iterations"]>1 for r in results)/len(results) if results else 0.0,"escalation_abort_rate":sum(r["status"] in {"escalated","aborted"} for r in results)/len(results) if results else 0.0,"wall_time_ms":int((perf_counter()-started)*1000),"by_category":by_category,"results":results}

async def main():
    p=argparse.ArgumentParser(); p.add_argument("--limit",type=int,default=50); p.add_argument("--output",default="../benchmark/results/live-agent.json"); a=p.parse_args()
    report=await run(max(1,min(a.limit,50))); out=Path(a.output); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in {"results","by_category"}},indent=2))
if __name__=="__main__": asyncio.run(main())
