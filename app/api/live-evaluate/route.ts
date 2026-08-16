import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { route } from "@/lib/engine";
import { callProvider, deterministicGrade, providerOrder, getProviderModel } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const task = typeof body.task === "string" && body.task.trim() ? body.task.trim() : "Explain three concrete reliability controls for a production RAG system.";
    const providers = providerOrder();
    if (!providers.length) return NextResponse.json({ error: "No model provider is configured. Add NVIDIA_API_KEY, HF_TOKEN, or OPENROUTER_API_KEY to Vercel Production." }, { status: 503 });

    const messages = [
      { role: "system" as const, content: "You are a production AI assistant. Answer directly, accurately, and concisely. Prefer concrete engineering controls and measurable trade-offs." },
      { role: "user" as const, content: task },
    ];

    let generation: Awaited<ReturnType<typeof callProvider>> | null = null;
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        generation = await callProvider(provider, messages, 160);
        break;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `${provider} failed`);
      }
    }
    if (!generation) return NextResponse.json({ error: `All configured providers failed: ${failures.join(" | ")}` }, { status: 502 });

    const grade = deterministicGrade(task, generation.output);
    const observed = [{ model: generation.model, quality: grade.quality, latencyMs: generation.latencyMs, cost: 0, reliability: 1 }];
    const decision = route(task, 0.8, 5000, 0.03, observed);
    const externalId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const trace = [
      { step: "Receive task", status: "complete", detail: "Task accepted by evaluation API" },
      { step: "Provider inference", status: "complete", detail: `${generation.provider} / ${generation.model} · ${generation.latencyMs}ms` },
      { step: "Independent grading", status: "complete", detail: `Quality ${(grade.quality * 100).toFixed(1)}% · ${grade.reason}` },
      { step: "Routing decision", status: decision.passed ? "complete" : "degraded", detail: decision.reason },
      ...(failures.length ? [{ step: "Provider fallback", status: "degraded", detail: failures.join(" | ") }] : []),
    ];

    const responsePayload = (persisted: boolean, runId: string, warning?: string) => ({
      runId, source: generation!.provider, provider: generation!.provider, task,
      status: decision.passed ? "passed" : "degraded", persisted, warning,
      decision: { selectedModel: decision.selected.model, reason: decision.reason },
      metrics: { quality: grade.quality, latencyMs: generation!.latencyMs, reliability: 1, cost: null, inputTokens: generation!.inputTokens, outputTokens: generation!.outputTokens },
      candidates: [{ model: generation!.model, provider: generation!.provider, output: generation!.output, ...grade, latencyMs: generation!.latencyMs, source: generation!.provider }],
      trace,
      providerFailures: failures,
    });

    if (!databaseConfigured()) {
      return NextResponse.json(responsePayload(false, externalId, "Evaluation completed, but persistence is not configured. Add DATABASE_URL (or a supported Postgres variable) to Vercel Production."));
    }

    try {
      const run = await db.evaluationRun.create({ data: {
        externalId, task, status: decision.passed ? "passed" : "degraded", selectedModel: decision.selected.model,
        reason: decision.reason, quality: grade.quality, latencyMs: generation.latencyMs, cost: 0, reliability: 1,
        candidatesJson: [{ model: generation.model, provider: generation.provider, output: generation.output, ...grade, inputTokens: generation.inputTokens, outputTokens: generation.outputTokens }],
        traceJson: trace,
      }});
      return NextResponse.json(responsePayload(true, run.externalId));
    } catch {
      return NextResponse.json(responsePayload(false, externalId, "Evaluation completed, but persistence failed. Check the Neon connection and Prisma schema."));
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Evaluation failed" }, { status: 502 });
  }
}
