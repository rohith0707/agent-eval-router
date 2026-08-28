import { AttemptResult, callProvider, configuredProviders, modelRegistry, providerOrder, runProviderCascade, type Message, type ProviderName, type ProviderResult } from "@/lib/providers";
import { gradeBenchmarkCase, type BenchmarkCase } from "@/lib/benchmark-grader";

export type ExperimentStrategy = "baseline" | "cheapest" | "adaptive";

export type ExperimentCaseResult = {
  caseId: string;
  category: string;
  strategy: ExperimentStrategy;
  status: "passed" | "failed" | "infra_failed";
  quality: number;
  latencyMs: number | null;
  provider: ProviderName | null;
  model: string | null;
  costUsd: number;
  fallbacks: number;
  attempts: AttemptResult[];
  output?: string;
  rationale: string;
};

export type StrategySummary = {
  strategy: ExperimentStrategy;
  total: number;
  evaluated: number;
  passed: number;
  infraFailed: number;
  taskSuccessRate: number | null;
  averageQuality: number | null;
  p95LatencyMs: number | null;
  costPerSuccessfulTaskUsd: number | null;
  availability: number | null;
  fallbackRate: number | null;
};

function pct(value: number | null): number | null {
  return value == null ? null : Number(value.toFixed(3));
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentile95(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

function buildPrompt(item: BenchmarkCase): Message[] {
  return [
    {
      role: "system",
      content: "You are being evaluated on a fixed production benchmark. Follow the task exactly. Be concise and do not invent facts.",
    },
    { role: "user", content: item.task },
  ];
}

function firstConfiguredCandidate(): { provider: ProviderName; model: string } | null {
  const configured = configuredProviders();
  for (const provider of providerOrder()) {
    const model = modelRegistry()[provider]?.[0];
    if (configured[provider] && model) return { provider, model };
  }
  return null;
}

function adaptiveCandidates(category: string): Array<{ provider: ProviderName; model: string }> {
  const registry = modelRegistry();
  const configured = configuredProviders();
  const candidates: Array<{ provider: ProviderName; model: string }> = [];
  const add = (provider: ProviderName, model?: string) => {
    if (configured[provider] && model && !candidates.some((candidate) => candidate.provider === provider && candidate.model === model)) {
      candidates.push({ provider, model });
    }
  };

  const models = {
    gemini: registry.gemini?.[0],
    hfFast: registry.huggingface?.[0],
    hfReasoning: registry.huggingface?.[1],
    nvidia: registry.nvidia?.[0],
    deepseek: registry.openrouter?.[1],
    free: registry.openrouter?.[0],
  };

  switch (category) {
    case "reasoning":
    case "agent_planning":
      add("openrouter", models.deepseek);
      add("huggingface", models.hfReasoning);
      add("gemini", models.gemini);
      break;
    case "rag":
      add("gemini", models.gemini);
      add("openrouter", models.deepseek);
      add("huggingface", models.hfFast);
      break;
    case "code_generation":
      add("huggingface", models.hfReasoning);
      add("openrouter", models.deepseek);
      add("gemini", models.gemini);
      break;
    case "safety":
    case "tool_calling":
    case "text_to_sql":
    case "structured_output":
      add("gemini", models.gemini);
      add("openrouter", models.deepseek);
      add("huggingface", models.hfFast);
      break;
    default:
      add("openrouter", models.free);
      add("gemini", models.gemini);
      add("huggingface", models.hfFast);
      add("nvidia", models.nvidia);
  }

  return candidates.length ? candidates : providerOrder().flatMap((provider) => {
    const model = registry[provider]?.[0];
    return configured[provider] && model ? [{ provider, model }] : [];
  });
}

async function attemptFixed(messages: Message[]): Promise<{ result: ProviderResult | null; attempts: AttemptResult[]; rationale: string }> {
  const candidate = firstConfiguredCandidate();
  if (!candidate) return { result: null, attempts: [], rationale: "No provider credentials are configured." };
  try {
    const result = await callProvider(candidate.provider, candidate.model, messages, 120, 3000);
    return {
      result,
      attempts: [{
        provider: result.provider,
        model: result.model,
        outcome: "success",
        latencyMs: result.latencyMs,
        estimatedCostUsd: result.estimatedCostUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        reasoningTokens: result.reasoningTokens,
      }],
      rationale: `Fixed baseline: ${candidate.provider}/${candidate.model}. No fallback or adaptive selection is used.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "fixed model failed";
    return {
      result: null,
      attempts: [{ provider: candidate.provider, model: candidate.model, outcome: "transport", latencyMs: 3000, detail: detail.slice(0, 180) }],
      rationale: `Fixed baseline failed on ${candidate.provider}/${candidate.model}.`,
    };
  }
}

async function attemptCheapest(messages: Message[]): Promise<{ result: ProviderResult | null; attempts: AttemptResult[]; rationale: string }> {
  const cascade = await runProviderCascade(messages, 120, {
    attemptTimeoutMs: 3000,
    totalDeadlineMs: 10000,
    maxModelsPerProvider: 2,
    costFirst: true,
  });
  return {
    result: cascade.result,
    attempts: cascade.attempts,
    rationale: "Cheapest viable: cost-first provider/model cascade with bounded fallback.",
  };
}

async function attemptAdaptive(category: string, messages: Message[]): Promise<{ result: ProviderResult | null; attempts: AttemptResult[]; rationale: string }> {
  const candidates = adaptiveCandidates(category);
  const attempts: AttemptResult[] = [];
  const rationale = `Adaptive policy: category=${category}; preferred=${candidates.map((candidate) => `${candidate.provider}/${candidate.model}`).join(" → ")}.`;

  for (const candidate of candidates) {
    try {
      const result = await callProvider(candidate.provider, candidate.model, messages, 120, 3000);
      attempts.push({
        provider: result.provider,
        model: result.model,
        outcome: "success",
        latencyMs: result.latencyMs,
        estimatedCostUsd: result.estimatedCostUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        reasoningTokens: result.reasoningTokens,
      });
      return { result, attempts, rationale };
    } catch (error) {
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        outcome: "transport",
        latencyMs: 3000,
        detail: error instanceof Error ? error.message.slice(0, 180) : "adaptive candidate failed",
      });
    }
  }
  return { result: null, attempts, rationale };
}

export async function runExperimentCase(item: BenchmarkCase, strategy: ExperimentStrategy): Promise<ExperimentCaseResult> {
  const messages = buildPrompt(item);
  const execution = strategy === "baseline"
    ? await attemptFixed(messages)
    : strategy === "cheapest"
      ? await attemptCheapest(messages)
      : await attemptAdaptive(item.category, messages);

  if (!execution.result) {
    return {
      caseId: item.id,
      category: item.category,
      strategy,
      status: "infra_failed",
      quality: 0,
      latencyMs: null,
      provider: null,
      model: null,
      costUsd: 0,
      fallbacks: Math.max(0, execution.attempts.length - 1),
      attempts: execution.attempts,
      rationale: execution.rationale,
    };
  }

  const evaluation = gradeBenchmarkCase(item, execution.result.output);
  return {
    caseId: item.id,
    category: item.category,
    strategy,
    status: evaluation.passed ? "passed" : "failed",
    quality: evaluation.quality,
    latencyMs: execution.result.latencyMs,
    provider: execution.result.provider,
    model: execution.result.model,
    costUsd: execution.result.estimatedCostUsd,
    fallbacks: Math.max(0, execution.attempts.length - 1),
    attempts: execution.attempts,
    output: execution.result.output,
    rationale: `${execution.rationale} Grader=${evaluation.graderVersion}; ${evaluation.reason}`,
  };
}

export function summarizeStrategy(results: ExperimentCaseResult[], strategy: ExperimentStrategy): StrategySummary {
  const scoped = results.filter((result) => result.strategy === strategy);
  const evaluated = scoped.filter((result) => result.status !== "infra_failed");
  const passed = scoped.filter((result) => result.status === "passed");
  const infraFailed = scoped.filter((result) => result.status === "infra_failed");
  const successfulCosts = passed.map((result) => result.costUsd).filter((cost) => cost >= 0);
  const latencies = evaluated.map((result) => result.latencyMs).filter((value): value is number => value != null);

  return {
    strategy,
    total: scoped.length,
    evaluated: evaluated.length,
    passed: passed.length,
    infraFailed: infraFailed.length,
    taskSuccessRate: pct(evaluated.length ? passed.length / evaluated.length : null),
    averageQuality: pct(average(evaluated.map((result) => result.quality))),
    p95LatencyMs: percentile95(latencies),
    costPerSuccessfulTaskUsd: passed.length ? Number((successfulCosts.reduce((sum, value) => sum + value, 0) / passed.length).toFixed(8)) : null,
    availability: pct(scoped.length ? evaluated.length / scoped.length : null),
    fallbackRate: pct(scoped.length ? scoped.filter((result) => result.fallbacks > 0).length / scoped.length : null),
  };
}
