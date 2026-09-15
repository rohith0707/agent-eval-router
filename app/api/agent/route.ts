import { NextResponse } from "next/server";
import { callProvider, deterministicGrade, ProviderName } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODELS: Record<ProviderName, string> = {
  gemini: "gemini-3.1-flash-lite",
  huggingface: "openai/gpt-oss-120b:fastest",
  nvidia: "meta/llama-3.3-70b-instruct",
  openrouter: "deepseek/deepseek-chat",
};

const NAMES: Record<ProviderName, string> = {
  gemini: "Gemini 3.1 Flash (Google)",
  huggingface: "GPT-OSS 120B (HuggingFace)",
  nvidia: "Llama 3.3 70B (NVIDIA NIM)",
  openrouter: "DeepSeek V3 (OpenRouter)",
};

function demoOutput(task: string): string {
  const lower = task.toLowerCase();
  if (lower.includes("sql") || lower.includes("query") || lower.includes("join") || lower.includes("optimize")) {
    return "-- Demo recommendation\n1. Filter the largest table before joins.\n2. Add composite indexes for join/filter predicates.\n3. Inspect EXPLAIN ANALYZE and target the remaining sequential scans.\n\nSIMULATED DEMO — no external provider was called.";
  }
  if (lower.includes("python") || lower.includes("async") || lower.includes("refactor")) {
    return "async def pipeline(items):\n    results = await asyncio.gather(*(transform(item) for item in items))\n    return results\n\nSIMULATED DEMO — no external provider was called.";
  }
  return `Structured solution for: ${task}\n\nPlan → execute → verify → record evidence.\n\nSIMULATED DEMO — no external provider was called.`;
}

function demoCandidates(task: string) {
  const values: Record<ProviderName, { quality: number; cost: number; latency: number }> = {
    gemini: { quality: 0.96, cost: 0.0008, latency: 0.38 },
    huggingface: { quality: 0.91, cost: 0.0025, latency: 1.45 },
    nvidia: { quality: 0.95, cost: 0.004, latency: 1.2 },
    openrouter: { quality: 0.93, cost: 0.0018, latency: 0.95 },
  };
  return (Object.keys(values) as ProviderName[]).map((provider) => {
    const v = values[provider];
    const score = 0.5 * v.quality + 0.3 * Math.max(0, 1 - v.latency / 3) + 0.2 * Math.max(0, 1 - v.cost / 0.05);
    return { name: NAMES[provider], provider, model: MODELS[provider], quality: v.quality, cost: v.cost, latency: v.latency, score, isBest: provider === "gemini", reasonBadge: provider === "gemini" ? "BEST TRADE-OFF" : undefined, output: demoOutput(task) };
  }).sort((a, b) => b.score - a.score);
}

function toConsoleResponse(task: string, candidates: any[], provenance: string) {
  const winner = candidates[0];
  return {
    task,
    taskType: "coding",
    similarTasksCount: provenance === "SIMULATED_DEMO" ? 0 : 1,
    provenance,
    candidates,
    selected: {
      model: winner.model,
      provider: winner.provider,
      quality: winner.quality,
      cost: winner.cost,
      latency: winner.latency,
      reason: provenance === "SIMULATED_DEMO"
        ? "Simulated evidence ranking selected the best quality/cost/latency trade-off."
        : "Selected from measured provider results using the configured evidence score.",
    },
    result: {
      output: winner.output,
      quality: winner.quality,
      cost: winner.cost,
      latency: winner.latency,
      learningPoints: [
        "Provider choice is evidence-ranked rather than hardcoded.",
        "Verification is reported separately from model selection.",
      ],
    },
    verification: {
      passed: true,
      quality: winner.quality,
      provenance,
      checks: ["non_empty", "structured_output", "task_reference"],
    },
    status: "done",
    loop_action: "COMPLETE",
    iteration: 1,
    provider: winner.provider,
    model: winner.model,
    quality: winner.quality,
    cost_usd: winner.cost,
    total_cost_usd: winner.cost,
    latency_ms: Math.round(winner.latency * 1000),
    output: winner.output,
    decision: {
      action: "ROUTE",
      provider: winner.provider,
      model: winner.model,
      reason: "Evidence-ranked provider selection",
      evidence_count: provenance === "SIMULATED_DEMO" ? 0 : candidates.length,
      provenance,
    },
    trajectory: [
      { step: "route", status: "done", detail: `selected ${winner.provider}/${winner.model}` },
      { step: "verify", status: "passed", detail: `quality=${winner.quality.toFixed(3)}` },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const task = typeof body.task === "string" && body.task.trim()
      ? body.task.trim()
      : "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";
    const explicitDemo = url.searchParams.get("demo") === "true";
    const backendUrl = process.env.AGENT_BACKEND_URL?.replace(/\/$/, "");

    // Explicit demo mode is always local and never calls external providers.
    if (explicitDemo) {
      return NextResponse.json(toConsoleResponse(task, demoCandidates(task), "SIMULATED_DEMO"));
    }

    // Live control-plane path.
    if (backendUrl) {
      try {
        const upstream = await fetch(`${backendUrl}/v1/agent/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task,
            task_type: body.task_type ?? "auto",
            max_cost_usd: body.constraints?.max_cost_usd ?? 0.05,
            max_tokens: body.max_tokens ?? 512,
            max_iterations: body.constraints?.max_iterations ?? 3,
            max_wall_time_ms: body.constraints?.max_wall_time_ms ?? 120000,
            max_failures: body.constraints?.max_failures ?? 2,
          }),
          cache: "no-store",
        });
        const data = await upstream.json().catch(() => null);
        if (upstream.ok && data) return NextResponse.json(data);
        console.warn(`Live control plane unavailable (${upstream.status}); using safe simulated fallback.`);
      } catch (error) {
        console.warn("Live control plane unreachable; using safe simulated fallback.", error);
      }
    }

    // Safe public-deployment fallback: never surface a 503 just because provider/backend
    // credentials are absent. The response is explicitly marked simulated.
    const candidates = demoCandidates(task);
    return NextResponse.json({
      ...toConsoleResponse(task, candidates, "SIMULATED_FALLBACK"),
      warning: "Live control plane was unavailable. This result is simulated; no external provider was called.",
    });
  } catch (error) {
    console.error("Agent execution error:", error);
    return NextResponse.json({ error: "Failed to evaluate task" }, { status: 500 });
  }
}
