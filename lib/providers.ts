import {
  getGeminiApiKey,
  getHuggingFaceToken,
  getNvidiaApiKey,
  getOpenRouterApiKey,
} from "@/lib/config";

export type ProviderName = "gemini" | "huggingface" | "nvidia" | "openrouter";
export type Message = { role: "system" | "user"; content: string };
export type ProviderResult = {
  provider: ProviderName;
  model: string;
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};
export type AttemptOutcome = "success" | "timeout" | "rejected" | "empty" | "transport";
export type AttemptResult = {
  provider: ProviderName;
  model: string;
  outcome: AttemptOutcome;
  latencyMs: number;
  statusCode?: number;
  detail?: string;
  estimatedCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
};
export type CascadeOptions = {
  attemptTimeoutMs?: number;
  totalDeadlineMs?: number;
  maxModelsPerProvider?: number;
  costFirst?: boolean;
  preferredProviders?: readonly ProviderName[];
};

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
  };
};

type ProviderHttpError = Error & { statusCode?: number; detail?: string };
type ModelMeta = { inputUsdPer1M: number; outputUsdPer1M: number; costTier: number };

const DEFAULT_ATTEMPT_TIMEOUT_MS = 3500;
const DEFAULT_TOTAL_DEADLINE_MS = 50000;

// Keep the default registry aligned with currently documented provider models.
// Operators can override any provider pool with <PROVIDER>_MODELS env vars.
const MODEL_REGISTRY: Readonly<Record<ProviderName, readonly string[]>> = {
  gemini: [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
  ],
  huggingface: [
    "openai/gpt-oss-120b:fastest",
    "Qwen/Qwen3-Coder-480B-A35B-Instruct:fastest",
    "deepseek-ai/DeepSeek-R1:fastest",
  ],
  nvidia: [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "meta/llama-3.3-70b-instruct",
  ],
  openrouter: [
    "openrouter/free",
    "deepseek/deepseek-v3.2",
    "deepseek/deepseek-chat",
  ],
};

const MODEL_META: Readonly<Record<string, ModelMeta>> = {
  "gemini-3.1-flash-lite": { inputUsdPer1M: 0.10, outputUsdPer1M: 0.40, costTier: 1 },
  "gemini-3.5-flash-lite": { inputUsdPer1M: 0.10, outputUsdPer1M: 0.40, costTier: 1 },
  "gemini-3.6-flash": { inputUsdPer1M: 0.20, outputUsdPer1M: 0.80, costTier: 2 },
  "gemini-3.7-flash": { inputUsdPer1M: 0.20, outputUsdPer1M: 0.80, costTier: 2 },
  "openai/gpt-oss-120b:fastest": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 1 },
  "Qwen/Qwen3-Coder-480B-A35B-Instruct:fastest": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 2 },
  "deepseek-ai/DeepSeek-R1:fastest": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 2 },
  "openai/gpt-oss-20b": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 1 },
  "openai/gpt-oss-120b": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 2 },
  "meta/llama-3.3-70b-instruct": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 3 },
  "openrouter/free": { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 0 },
  "deepseek/deepseek-v3.2": { inputUsdPer1M: 0.2288, outputUsdPer1M: 0.3432, costTier: 2 },
  "deepseek/deepseek-chat": { inputUsdPer1M: 0.2002, outputUsdPer1M: 0.8001, costTier: 2 },
};

const PROVIDER_ORDER: readonly ProviderName[] = ["gemini", "huggingface", "nvidia", "openrouter"];

const ENDPOINTS: Readonly<Record<ProviderName, string>> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  huggingface: "https://router.huggingface.co/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

function envPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getCredentials(provider: ProviderName): string | undefined {
  switch (provider) {
    case "gemini": return getGeminiApiKey();
    case "huggingface": return getHuggingFaceToken();
    case "nvidia": return getNvidiaApiKey();
    case "openrouter": return getOpenRouterApiKey();
  }
}

function getConfiguredModels(provider: ProviderName): readonly string[] {
  const override = process.env[`${provider.toUpperCase()}_MODELS`];
  if (!override) return MODEL_REGISTRY[provider];
  const models = override.split(",").map(value => value.trim()).filter(Boolean);
  return models.length ? models : MODEL_REGISTRY[provider];
}

function modelMeta(model: string): ModelMeta {
  return MODEL_META[model] ?? { inputUsdPer1M: 0, outputUsdPer1M: 0, costTier: 99 };
}

function sortModelsByCost(models: readonly string[]): string[] {
  return [...models].sort((a, b) => modelMeta(a).costTier - modelMeta(b).costTier || a.localeCompare(b));
}

function orderedProviders(preferredProviders: readonly ProviderName[] | undefined): ProviderName[] {
  const configured = new Set(providerOrder());
  if (!preferredProviders?.length) return [...configured];
  const preferred = preferredProviders.filter((provider, index) => configured.has(provider) && preferredProviders.indexOf(provider) === index);
  const remainder = providerOrder().filter(provider => !preferred.includes(provider));
  return [...preferred, ...remainder];
}

const getEndpoint = (provider: ProviderName): string => ENDPOINTS[provider];

function isProviderResponse(value: unknown): value is ProviderResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as ProviderResponse;
  return response.choices === undefined || Array.isArray(response.choices);
}

function sanitizeDetail(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function classifyFailure(error: unknown): AttemptOutcome {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("request timed out")) return "timeout";
  if (message.includes("returned empty output")) return "empty";
  if (/\b(400|401|402|403|404|409|422|429|500|502|503|504)\b/.test(message)) return "rejected";
  return "transport";
}

function errorMetadata(error: unknown): Pick<AttemptResult, "statusCode" | "detail"> {
  const candidate = error as ProviderHttpError;
  return { statusCode: candidate?.statusCode, detail: candidate?.detail };
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const meta = modelMeta(model);
  return Number((((inputTokens / 1_000_000) * meta.inputUsdPer1M) + ((outputTokens / 1_000_000) * meta.outputUsdPer1M)).toFixed(8));
}

export function configuredProviders(): Record<ProviderName, boolean> {
  return Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, Boolean(getCredentials(provider))])) as Record<ProviderName, boolean>;
}

export function providerOrder(): ProviderName[] {
  const configured = configuredProviders();
  return PROVIDER_ORDER.filter(provider => configured[provider]);
}

export function modelRegistry(): Record<ProviderName, string[]> {
  return Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, getConfiguredModels(provider).slice().sort((a, b) => modelMeta(a).costTier - modelMeta(b).costTier)])) as Record<ProviderName, string[]>;
}

export async function callProvider(
  provider: ProviderName,
  model: string,
  messages: Message[],
  maxTokens = 100,
  attemptTimeoutMs = envPositiveInt("PROVIDER_ATTEMPT_TIMEOUT_MS", DEFAULT_ATTEMPT_TIMEOUT_MS),
): Promise<ProviderResult> {
  const key = getCredentials(provider);
  if (!key) throw new Error(`${provider} credentials are not configured`);

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);

  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://agent-eval-router.vercel.app";
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "Agent Eval Router";
    }

    const requestBody: Record<string, unknown> = { model, messages, max_tokens: maxTokens, stream: false };
    const response = await fetch(getEndpoint(provider), {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`${provider} ${response.status}: ${sanitizeDetail(body)}`) as ProviderHttpError;
      error.statusCode = response.status;
      error.detail = sanitizeDetail(body);
      throw error;
    }

    const parsed: unknown = JSON.parse(body);
    if (!isProviderResponse(parsed)) throw new Error(`${provider} returned an invalid response`);
    const output = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!output) throw new Error(`${provider} returned empty output`);

    const usage = parsed.usage ?? {};
    const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    const reasoningTokens = Number(usage.reasoning_tokens ?? 0);
    const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens + reasoningTokens);

    return {
      provider,
      model,
      output,
      latencyMs: Math.round(performance.now() - started),
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      estimatedCostUsd: estimateCost(model, inputTokens, outputTokens),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error(`${provider} request timed out`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function runProviderCascade(messages: Message[], maxTokens = 100, options: CascadeOptions = {}) {
  const started = performance.now();
  const attempts: AttemptResult[] = [];
  const attemptTimeoutMs = options.attemptTimeoutMs ?? envPositiveInt("PROVIDER_ATTEMPT_TIMEOUT_MS", DEFAULT_ATTEMPT_TIMEOUT_MS);
  const totalDeadlineMs = options.totalDeadlineMs ?? envPositiveInt("PROVIDER_TOTAL_DEADLINE_MS", DEFAULT_TOTAL_DEADLINE_MS);
  const maxModelsPerProvider = options.maxModelsPerProvider ?? Number.POSITIVE_INFINITY;
  const costFirst = options.costFirst ?? true;
  const providers = orderedProviders(options.preferredProviders);

  outer: for (const provider of providers) {
    const configuredModels = getConfiguredModels(provider);
    const models = (costFirst ? sortModelsByCost(configuredModels) : [...configuredModels]).slice(0, maxModelsPerProvider);

    for (const model of models) {
      const elapsed = performance.now() - started;
      if (elapsed >= totalDeadlineMs) break outer;
      const remaining = totalDeadlineMs - elapsed;
      const timeoutForAttempt = Math.min(attemptTimeoutMs, Math.max(1, Math.floor(remaining)));
      const attemptStarted = performance.now();

      try {
        const result = await callProvider(provider, model, messages, maxTokens, timeoutForAttempt);
        attempts.push({ provider, model, outcome: "success", latencyMs: result.latencyMs, estimatedCostUsd: result.estimatedCostUsd, inputTokens: result.inputTokens, outputTokens: result.outputTokens, reasoningTokens: result.reasoningTokens });
        return { result, attempts, exhausted: false };
      } catch (error) {
        const metadata = errorMetadata(error);
        const outcome = classifyFailure(error);
        attempts.push({ provider, model, outcome, latencyMs: Math.round(performance.now() - attemptStarted), ...metadata });
        if (metadata.statusCode === 429 || metadata.statusCode === 402 || metadata.statusCode === 401 || metadata.statusCode === 403 || (metadata.statusCode && metadata.statusCode >= 500)) {
          continue outer;
        }
      }
    }
  }

  return { result: null, attempts, exhausted: true };
}

export function deterministicGrade(task: string, answer: string) {
  const text = `${task}\n${answer}`.toLowerCase();
  const checks = [
    /reliab|validation|guardrail|fallback|timeout|retry/.test(text),
    /retriev|ground|context|embedding|chunk/.test(text),
    /cost|latency|observability|monitor|trace/.test(text),
  ];
  const score = checks.filter(Boolean).length / checks.length;
  return {
    quality: Number(score.toFixed(3)),
    correctness: Number(score.toFixed(3)),
    relevance: Number((checks[0] || checks[1] ? 0.9 : 0.5).toFixed(3)),
    groundedness: Number((checks[1] ? 0.9 : 0.5).toFixed(3)),
    reason: `Deterministic rubric: ${checks.filter(Boolean).length}/${checks.length} checks passed.`,
  };
}
