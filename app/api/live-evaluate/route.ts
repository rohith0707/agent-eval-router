import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { route } from "@/lib/engine";
import { deterministicGrade, providerOrder, runProviderCascade } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const task = typeof body.task === "string" && body.task.trim()
      ? body.task.trim()
      : "Explain three concrete reliability controls for a production RAG system.";

    if (!providerOrder().length) {
      return NextResponse.json(
        { error: "Evaluation service is temporarily unavailable." },
        { status: 503 }
      );
    }

    const messages = [
      { role: "system" as const, content: "You are a production AI assistant. Answer directly, accurately, and concisely. Prefer concrete engineering controls and measurable trade-offs." },
      { role: "user" as const, content: task },
    ];

    // The cascade owns provider/model fallback. Raw provider errors never leave this route.
    const cascade = await runProviderCascade(messages, 160);
    const generation = cascade.result;

    if (!generation) {
      console.error("Provider cascade exhausted", {
        attempts: cascade.attempts.map(({ provider, model, outcome, latencyMs }) => ({ provider, model, outcome, latencyMs })),
      });
      return NextResponse.json(
        { error: "Evaluation service is temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    const grade = deterministicGrade(task, generation.output);
    const observed = [{ model: generation.model, quality: grade.quality, latencyMs: generation.latencyMs, cost: 0, reliability: 1 }];
    const decision = route(task, 0.8, 5000, 0.03, observed);
    const externalId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const fallbackCount = cascade.attempts.filter(a => a.outcome !== "success").length;
    const trace = [
      { step: "Receive task", status: "complete", detail: "Task accepted by evaluation API" },
      { step: "Model cascade", status: "complete", detail: `${cascade.attempts.length} model attempts · ${fallbackCount} internal fallbacks` },
      { step: "Provider inference", status: "complete", detail: `${generation.provider} / ${generation.model} · ${generation.latencyMs}ms` },
      { step: "Independent grading", status: "complete", detail: `Quality ${(grade.quality * 100).toFixed(1)}% · ${grade.reason}` },
      { step: "Routing decision", status: decision.passed ? "complete" : "degraded", detail: decision.reason },
    ];

    const responsePayload = (persisted: boolean, runId: string, warning?: string) => ({
      runId,
      source: generation.provider,
      provider: generation.provider,
      task,
      status: decision.passed ? "passed" : "degraded",
      persisted,
      warning,
      decision: { selectedModel: decision.selected.model, reason: decision.reason },
      metrics: {
        quality: grade.quality,
        latencyMs: generation.latencyMs,
        reliability: 1,
        cost: null,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        fallbackCount,
      },
      candidates: [{ model: generation.model, provider: generation.provider, output: generation.output, ...grade, latencyMs: generation.latencyMs, source: generation.provider }],
      trace,
      // Deliberately omit raw provider/model failure messages from the user-facing payload.
    });

    if (!databaseConfigured()) {
      return NextResponse.json(responsePayload(
        false,
        externalId,
        "Evaluation completed, but persistence is not configured."
      ));
    }

    try {
      const run = await db.evaluationRun.create({
        data: {
          externalId,
          task,
          status: decision.passed ? "passed" : "degraded",
          selectedModel: decision.selected.model,
          reason: decision.reason,
          quality: grade.quality,
          latencyMs: generation.latencyMs,
          cost: 0,
          reliability: 1,
          candidatesJson: [{ model: generation.model, provider: generation.provider, output: generation.output, ...grade, inputTokens: generation.inputTokens, outputTokens: generation.outputTokens }],
          traceJson: trace,
        },
      });
      return NextResponse.json(responsePayload(true, run.externalId));
    } catch (error) {
      console.error("Evaluation persistence failed", error);
      return NextResponse.json(responsePayload(
        false,
        externalId,
        "Evaluation completed, but persistence is temporarily unavailable."
      ));
    }
  } catch (error) {
    console.error("Evaluation route failed", error);
    return NextResponse.json(
      { error: "Evaluation service is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
