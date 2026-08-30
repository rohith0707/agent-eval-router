import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { route } from "@/lib/engine";
import { buildExecutionPlan } from "@/lib/agent-plan";
import { deterministicGrade, runProviderCascade } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_TASK = "Explain three concrete reliability controls for a production RAG system.";
const MAX_TASK_LENGTH = 12_000;

function normalizeTask(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_TASK;
  const task = value.trim();
  return task.length > 0 ? task.slice(0, MAX_TASK_LENGTH) : DEFAULT_TASK;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const task = normalizeTask(body && typeof body === "object" ? (body as Record<string, unknown>).task : undefined);
    const executionPlan = buildExecutionPlan(task);

    const messages = [
      {
        role: "system" as const,
        content: "You are a production AI assistant. Answer directly, accurately, and concisely. Prefer concrete engineering controls and measurable trade-offs.",
      },
      { role: "user" as const, content: task },
    ];

    // Plan first, then execute. The provider cascade receives the task-aware
    // provider order before any model inference occurs.
    const cascade = await runProviderCascade(messages, 160, {
      preferredProviders: executionPlan.preferredProviders,
      maxModelsPerProvider: 2,
    });
    const generation = cascade.result;

    if (!generation) {
      console.error("Provider cascade exhausted", {
        taskType: executionPlan.taskType,
        attempts: cascade.attempts,
      });
      return NextResponse.json(
        { error: "Evaluation service is temporarily unavailable. Please try again." },
        { status: 503 },
      );
    }

    const grade = deterministicGrade(task, generation.output);
    const observed = [{
      model: generation.model,
      quality: grade.quality,
      latencyMs: generation.latencyMs,
      cost: generation.estimatedCostUsd,
      reliability: 1,
    }];
    const decision = route(task, 0.8, 5000, 0.03, observed);
    const externalId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fallbackCount = Math.max(0, cascade.attempts.length - 1);
    const measuredCost = generation.estimatedCostUsd;

    const trace = [
      { step: "Receive task", status: "complete", detail: "Task accepted by evaluation API" },
      { step: "Pre-inference routing", status: "complete", detail: `${executionPlan.taskType} · provider preference ${executionPlan.preferredProviders.join(" → ")}` },
      { step: "Model cascade", status: "complete", detail: `${cascade.attempts.length} model attempts · ${fallbackCount} internal fallbacks` },
      { step: "Provider inference", status: "complete", detail: `${generation.provider} / ${generation.model} · ${generation.latencyMs}ms · $${measuredCost.toFixed(8)}` },
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
      executionPlan: {
        taskType: executionPlan.taskType,
        preferredProviders: executionPlan.preferredProviders,
        requiresTool: executionPlan.requiresTool,
        maxSteps: executionPlan.maxSteps,
      },
      decision: { selectedModel: decision.selected.model, reason: decision.reason },
      metrics: {
        quality: grade.quality,
        latencyMs: generation.latencyMs,
        reliability: 1,
        cost: measuredCost,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        reasoningTokens: generation.reasoningTokens,
        fallbackCount,
      },
      candidates: [{
        model: generation.model,
        provider: generation.provider,
        output: generation.output,
        ...grade,
        latencyMs: generation.latencyMs,
        estimatedCostUsd: measuredCost,
        source: generation.provider,
      }],
      trace,
    });

    if (!databaseConfigured()) {
      return NextResponse.json(responsePayload(false, externalId, "Evaluation completed, but persistence is not configured."));
    }

    try {
      const run = await db.evaluationRun.create({
        data: {
          externalId,
          task,
          status: decision.passed ? "passed" : "degraded",
          selectedModel: decision.selected.model,
          reason: `${executionPlan.taskType} · ${decision.reason}`,
          quality: grade.quality,
          latencyMs: generation.latencyMs,
          cost: measuredCost,
          reliability: 1,
          candidatesJson: [{
            model: generation.model,
            provider: generation.provider,
            output: generation.output,
            ...grade,
            estimatedCostUsd: measuredCost,
            inputTokens: generation.inputTokens,
            outputTokens: generation.outputTokens,
            reasoningTokens: generation.reasoningTokens,
          }],
          traceJson: trace,
        },
      });
      return NextResponse.json(responsePayload(true, run.externalId));
    } catch (error) {
      console.error("Evaluation persistence failed", error);
      return NextResponse.json(responsePayload(false, externalId, "Evaluation completed, but persistence is temporarily unavailable."));
    }
  } catch (error) {
    console.error("Evaluation route failed", error);
    return NextResponse.json(
      { error: "Evaluation service is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
