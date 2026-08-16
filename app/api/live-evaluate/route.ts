import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { candidates, route } from "@/lib/engine";
import { deterministicGrade, nvidiaChat } from "@/lib/nvidia";
import { getNvidiaModel } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const task = typeof body.task === "string" && body.task.trim() ? body.task.trim() : "Explain three concrete reliability controls for a production RAG system.";
    const model = getNvidiaModel();
    let output = "";
    let latencyMs = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let source = "nvidia_nim";
    let grade: ReturnType<typeof deterministicGrade>;

    try {
      const generation = await nvidiaChat(model, [
        { role: "system", content: "You are a production AI assistant. Answer directly and concisely." },
        { role: "user", content: task },
      ], 220);
      output = generation.output;
      latencyMs = generation.latencyMs;
      inputTokens = generation.inputTokens;
      outputTokens = generation.outputTokens;
      grade = deterministicGrade(task, output);
    } catch (error) {
      if (!process.env.ALLOW_EVAL_FALLBACK) throw error;
      source = "deterministic_fallback";
      output = "NVIDIA inference was unavailable. This run uses the local deterministic evaluator and is clearly marked as fallback evidence.";
      grade = deterministicGrade(task, output);
    }

    const observed = [{ model, quality: grade.quality, latencyMs, cost: 0, reliability: source === "nvidia_nim" ? 1 : 0.5 }];
    const decision = route(task, 0.8, 5000, 0.03, observed);
    const externalId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const trace = [
      { step: "Receive task", status: "complete", detail: "Task accepted by evaluation API" },
      { step: "NVIDIA NIM inference", status: source === "nvidia_nim" ? "complete" : "fallback", detail: `${model}${latencyMs ? ` · ${latencyMs}ms` : ""}` },
      { step: "Independent grading", status: "complete", detail: `Quality ${(grade.quality * 100).toFixed(1)}% · ${grade.reason}` },
      { step: "Routing decision", status: decision.passed ? "complete" : "degraded", detail: decision.reason },
    ];

    if (!databaseConfigured()) {
      return NextResponse.json({
        runId: externalId, task, status: decision.passed ? "passed" : "degraded", persisted: false,
        warning: "Evaluation completed, but persistence is not configured. Add DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL) to Vercel Production.",
        decision: { selectedModel: decision.selected.model, reason: decision.reason },
        metrics: { quality: grade.quality, latencyMs, reliability: source === "nvidia_nim" ? 1 : 0.5, cost: null, inputTokens, outputTokens },
        candidates: [{ model, output, ...grade, latencyMs, source }], trace
      });
    }

    try {
      const run = await db.evaluationRun.create({ data: {
        externalId, task, status: decision.passed ? "passed" : "degraded", selectedModel: decision.selected.model,
        reason: decision.reason, quality: grade.quality, latencyMs, cost: 0, reliability: source === "nvidia_nim" ? 1 : 0.5,
        candidatesJson: [{ model, output, ...grade, source, inputTokens, outputTokens }], traceJson: trace,
      }});
      return NextResponse.json({ runId: run.externalId, source, task, status: run.status, persisted: true,
        decision: { selectedModel: run.selectedModel, reason: run.reason },
        metrics: { quality: grade.quality, latencyMs, reliability: run.reliability, cost: null, inputTokens, outputTokens },
        candidates: [{ model, output, ...grade, latencyMs, source }], trace });
    } catch {
      return NextResponse.json({
        runId: externalId, source, task, status: decision.passed ? "passed" : "degraded", persisted: false,
        warning: "Evaluation completed, but persistence failed. Check the Neon connection and ensure the Prisma EvaluationRun table exists.",
        decision: { selectedModel: decision.selected.model, reason: decision.reason },
        metrics: { quality: grade.quality, latencyMs, reliability: source === "nvidia_nim" ? 1 : 0.5, cost: null, inputTokens, outputTokens },
        candidates: [{ model, output, ...grade, latencyMs, source }], trace
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation failed";
    return NextResponse.json({ error: message, source: "nvidia_nim" }, { status: 502 });
  }
}
