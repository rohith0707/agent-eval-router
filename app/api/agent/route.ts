import { NextResponse } from "next/server";
import {
  configuredProviders,
  providerOrder,
  runProviderCascade,
  type Message,
  type ProviderName,
} from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Evidence = { claim: string; evidence: string; status: string };

function classifyTaskType(task: string): string {
  const text = task.toLowerCase();
  if (/\b(change|switch|configure|migrate|replace).{0,40}\b(model|provider|api|deployment|integration)\b/.test(text)) return "configuration";
  if (/\b(review|audit|risk|pr|pull request|security)\b/.test(text)) return "review";
  if (/\b(fix|debug|bug|ci|test|compile|refactor|migration|deploy|implement|build)\b/.test(text)) return "engineering";
  if (/\b(what is|who is|why |how does|compare |explain |research|investigate|analy[sz]e|gpt|model)\b/.test(text)) return "research";
  return "general";
}

function taskSystemPrompt(taskType: string): string {
  return [
    "You are the execution worker inside a production AI runtime.",
    "Do real reasoning on the user's task, but never claim an external action happened unless the runtime actually executed that action.",
    "Return a useful artifact for the requested task.",
    "Separate facts, assumptions, proposed actions, and verification requirements.",
    "Do not describe hidden chain-of-thought.",
    "Task class: " + taskType + ".",
  ].join(" ");
}

function buildDeliverable(task: string, taskType: string, output: string) {
  const titles: Record<string, string> = {
    engineering: "Engineering result",
    configuration: "Configuration plan",
    review: "Risk review",
    research: "Research result",
    general: "Task result",
  };
  const summaries: Record<string, string> = {
    engineering: "A live model produced the requested engineering artifact. External repository changes are only claimed when a tool execution is present.",
    configuration: "A live model analyzed the requested system change and separated the proposed change from actions actually executed.",
    review: "A live model produced a structured review with risks, evidence requirements, and next actions.",
    research: "A live model produced a structured answer. Time-sensitive claims should be verified against current sources before operational use.",
    general: "A live model produced a structured result for the submitted task.",
  };
  return {
    type: titles[taskType] ?? "Task result",
    title: titles[taskType] ?? "Task result",
    summary: summaries[taskType] ?? summaries.general,
    sections: [
      { title: "Result", body: output.slice(0, 6000) },
      { title: "Execution boundary", body: "This run used a configured live model provider. No external system change is claimed unless a recorded tool action exists." },
      {
        title: "Next verification",
        body: taskType === "engineering"
          ? "Run repository tests, build, and inspect the resulting diff before marking the task complete."
          : "Validate the highest-risk claims or actions against appropriate system evidence before treating the result as operationally complete.",
      },
    ],
  };
}

function parseVerification(value: string): { passed: boolean; quality: number; checks: string[]; reason: string } | null {
  try {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(value.slice(start, end + 1)) as {
      passed?: boolean;
      quality?: number;
      checks?: unknown;
      reason?: string;
    };
    const checks = Array.isArray(parsed.checks) ? parsed.checks.map(String).slice(0, 8) : [];
    if (typeof parsed.passed !== "boolean") return null;
    return {
      passed: parsed.passed,
      quality: Math.max(0, Math.min(1, Number(parsed.quality ?? (parsed.passed ? 0.8 : 0.5)))),
      checks,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "Verifier returned a structured decision.",
    };
  } catch {
    return null;
  }
}

async function verifyOutput(
  task: string,
  taskType: string,
  output: string,
  workerProvider: ProviderName,
  maxTokens: number,
) {
  const configured = providerOrder();
  const alternatives = configured.filter((provider) => provider !== workerProvider);
  const verifierProviders = alternatives.length ? alternatives : configured;
  const messages: Message[] = [
    {
      role: "system",
      content:
        "You are the verification worker. Evaluate the candidate result against the user's task. Do not reward confident prose. Return ONLY JSON with keys passed (boolean), quality (0..1), checks (array of short strings), reason (string).",
    },
    {
      role: "user",
      content:
        "Task: " + task + "\nTask class: " + taskType + "\nCandidate result:\n" + output.slice(0, 12000) + "\n\nA result passes only if it is relevant, concrete, internally coherent, and honest about external actions.",
    },
  ];

  const verifier = await runProviderCascade(messages, Math.min(320, maxTokens), {
    attemptTimeoutMs: 5000,
    totalDeadlineMs: 12000,
    maxModelsPerProvider: 1,
    restrictToProviders: verifierProviders,
  });

  if (verifier.result) {
    const parsed = parseVerification(verifier.result.output);
    if (parsed) {
      return {
        ...parsed,
        provenance: "LIVE_VERIFIER",
        provider: verifier.result.provider,
        model: verifier.result.model,
      };
    }
    return {
      passed: false,
      quality: 0.0,
      checks: ["verifier_response_unstructured"],
      reason: "The independent verifier responded, but its output was not valid verification JSON. Completion is withheld.",
      provenance: "VERIFICATION_INCOMPLETE",
      provider: verifier.result.provider,
      model: verifier.result.model,
    };
  }

  return {
    passed: false,
    quality: 0.0,
    checks: ["independent_verifier_unavailable"],
    reason: "No independent verifier provider is available. Completion is withheld.",
    provenance: "VERIFICATION_INCOMPLETE",
    provider: workerProvider,
    model: "contract-check",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const task =
      typeof body.task === "string" && body.task.trim()
        ? body.task.trim()
        : "Fix the failing CI contract test in the agent runtime, verify the fix, and stop only when the pipeline passes.";

    const backendUrl = process.env.AGENT_BACKEND_URL?.replace(/\/$/, "");
    const taskType = body.task_type && body.task_type !== "auto" ? String(body.task_type) : classifyTaskType(task);
    const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 700, 200), 1200);
    const maxCost = Math.max(Number(body.constraints?.max_cost_usd) || 0.05, 0.001);

    if (backendUrl) {
      const upstream = await fetch(backendUrl + "/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          task_type: taskType,
          max_cost_usd: maxCost,
          max_tokens: maxTokens,
          max_iterations: body.constraints?.max_iterations ?? 3,
          max_wall_time_ms: body.constraints?.max_wall_time_ms ?? 120000,
          max_failures: body.constraints?.max_failures ?? 2,
        }),
        cache: "no-store",
      });
      const data = await upstream.json().catch(() => null);
      if (upstream.ok && data) {
        return NextResponse.json({
          ...data,
          provenance: data.provenance ?? "LIVE_CONTROL_PLANE",
          task_type: data.task_type ?? taskType,
          deliverable: data.deliverable ?? buildDeliverable(task, taskType, String(data.output ?? "")),
        });
      }
      return NextResponse.json(
        { error: "Live control plane returned HTTP " + upstream.status + ".", provenance: "LIVE_CONTROL_PLANE_ERROR" },
        { status: upstream.status || 502 },
      );
    }

    const providers = configuredProviders();
    if (!Object.values(providers).some(Boolean)) {
      return NextResponse.json(
        {
          error: "No live model provider is configured.",
          detail: "Configure at least one provider credential for the deployment before running tasks.",
          required: ["GEMINI_API_KEY", "HF_TOKEN", "NVIDIA_API_KEY", "OPENROUTER_API_KEY"],
          provenance: "LIVE_RUNTIME_UNCONFIGURED",
        },
        { status: 503 },
      );
    }

    const messages: Message[] = [
      { role: "system", content: taskSystemPrompt(taskType) },
      { role: "user", content: task },
    ];

    const worker = await runProviderCascade(messages, maxTokens, {
      attemptTimeoutMs: 7000,
      totalDeadlineMs: 26000,
      maxModelsPerProvider: 2,
    });

    if (!worker.result) {
      return NextResponse.json(
        {
          error: "Live providers could not complete the task.",
          attempts: worker.attempts,
          provenance: "LIVE_RUNTIME_PROVIDER_FAILURE",
        },
        { status: 502 },
      );
    }

    const verification = await verifyOutput(task, taskType, worker.result.output, worker.result.provider, maxTokens);
    const evidence: Evidence[] = verification.checks.map((check) => ({
      claim: check.replaceAll("_", " "),
      evidence: verification.passed
        ? "The live verification stage accepted this contract check."
        : "The verification stage did not establish this check as passed.",
      status: verification.passed ? "verified" : "review",
    }));

    return NextResponse.json({
      provenance: "LIVE_PROVIDER_RUNTIME",
      run_id: "live-" + Date.now(),
      status: verification.passed ? "done" : "needs_review",
      loop_action: verification.passed ? "COMPLETE" : "ESCALATE",
      iteration: 1,
      task,
      task_type: taskType,
      provider: worker.result.provider,
      model: worker.result.model,
      output: worker.result.output,
      deliverable: buildDeliverable(task, taskType, worker.result.output),
      candidates: worker.attempts,
      selected: {
        provider: worker.result.provider,
        model: worker.result.model,
        reason: "Selected from configured providers by bounded live cascade.",
      },
      verification,
      evidence,
      total_cost_usd: worker.result.estimatedCostUsd,
      latency_ms: worker.result.latencyMs,
      decision: {
        action: verification.passed ? "COMPLETE" : "ESCALATE",
        policy_action: "ALLOW",
        reason_code: verification.provenance,
        reason: verification.reason,
        risk: taskType === "configuration" ? "medium" : "low",
        evidence_count: evidence.length,
        provenance: "LIVE_PROVIDER_RUNTIME",
      },
      trajectory: [
        { step: "plan", status: "complete", detail: "classified task as " + taskType, iteration: 1 },
        { step: "route", status: "complete", detail: "selected " + worker.result.provider + "/" + worker.result.model, iteration: 1 },
        { step: "execute", status: "complete", detail: "live provider returned a candidate result", iteration: 1 },
        { step: "verify", status: verification.passed ? "passed" : "failed", detail: verification.reason, iteration: 1 },
      ],
      limits: {
        max_cost_usd: maxCost,
        max_iterations: body.constraints?.max_iterations ?? 3,
        max_wall_time_ms: body.constraints?.max_wall_time_ms ?? 120000,
      },
    });
  } catch (error) {
    console.error("Live agent execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Live agent execution failed.", provenance: "LIVE_RUNTIME_ERROR" },
      { status: 500 },
    );
  }
}
