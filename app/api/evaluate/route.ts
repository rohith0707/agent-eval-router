import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route, candidates } from "@/lib/engine";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body.task === "string" && body.task.trim() ? body.task.trim() : "Evaluate a production AI task";
  const qualityThreshold = Number(body.qualityThreshold ?? 0.9);
  const latencyBudgetMs = Number(body.latencyBudgetMs ?? 2500);
  const costBudget = Number(body.costBudget ?? 0.03);
  const decision = route(task, qualityThreshold, latencyBudgetMs, costBudget);
  const externalId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const trace = [
    { step: "Classify task", status: "complete", detail: "Task accepted for routing" },
    { step: "Apply routing policy", status: "complete", detail: `${decision.eligible.length} eligible candidates` },
    { step: `Select ${decision.selected.model}`, status: "complete", detail: decision.reason },
    { step: "Evaluate quality / latency / cost / reliability", status: "complete", detail: "Benchmark metrics recorded" },
  ];

  let persisted = true;
  try {
    const run = await db.evaluationRun.create({
      data: {
        externalId,
        task,
        status: decision.passed ? "passed" : "degraded",
        selectedModel: decision.selected.model,
        reason: decision.reason,
        quality: decision.selected.quality,
        latencyMs: decision.selected.latencyMs,
        cost: decision.selected.cost,
        reliability: decision.selected.reliability,
        candidatesJson: candidates,
        traceJson: trace,
      },
    });
    return NextResponse.json({ runId: run.externalId, task, status: run.status, decision: { selectedModel: run.selectedModel, reason: run.reason }, metrics: { quality: run.quality, latencyMs: run.latencyMs, cost: run.cost, reliability: run.reliability }, candidates: candidates.map((m) => ({ ...m, eligible: decision.eligible.some((e) => e.model === m.model) })), trace });
  } catch {
    persisted = false;
  }

  return NextResponse.json({
    runId: externalId,
    task,
    status: decision.passed ? "passed" : "degraded",
    persisted,
    decision: { selectedModel: decision.selected.model, reason: decision.reason },
    metrics: decision.selected,
    candidates: candidates.map((m) => ({ ...m, eligible: decision.eligible.some((e) => e.model === m.model) })),
    trace,
  });
}
