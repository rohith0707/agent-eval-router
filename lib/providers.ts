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
  totalTokens: number;
};
export type AttemptOutcome = "success" | "timeout" | "rejected" | "empty" | "transport";
export type AttemptResult = { provider: ProviderName; model: string; outcome: AttemptOutcome; latencyMs: number };
export type CascadeOptions = {
  attemptTimeoutMs?: number;
  totalDeadlineMs?: number;
  maxModelsPerProvider?: number;
};

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
};

const DEFAULT_ATTEMPT_TIMEOUT_MS = 3500;
const DEFAULT_TOTAL_DEADLINE_MS = 50000;

const MODEL_REGISTRY: Readonly<Record<ProviderName, readonly string[]>> = {
  gemini: [
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
  ],
  huggingface: [
    "google/gemma-2-2b-it",
    "Qwen/Qwen3-4B-Thinking-2507",
    "Qwen/Qwen2.5-7B-Instruct-1M",
  ],
  nvidia: [
    "meta/llama-3.2-1b-instruct",
    "meta/llama-3.2-3b-instruct",
    "meta/llama-3.1-8b-instruct",
  ],
  openrouter: ["openrouter/free"],
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
    case "gemini":
      return getGeminiApiKey();
    case "huggingface":
      return getHuggingFaceToken();
    case "nvidia":
      return getNvidiaApiKey();
    case "openrouter":
      return getOpenRouterApiKey();
  }
}

function getConfiguredModels(provider: ProviderName): readonly string[] {
  const override = process.env[`${provider.toUpperCase()}_MODELS`];
  if (!override) return MODEL_REGISTRY[provider];
  const models = override.split(",").map(value => value.trim()).filter(Boolean);
  return models.length ? models : MODEL_REGISTRY[provider];
}

const getEndpoint = (provider: ProviderName): string => ENDPOINTS[provider];

function isProviderResponse(value: unknown): value is ProviderResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as ProviderResponse;
  return response.choices === undefined || Array.isArray(response.choices);
}

function classifyFailure(error: unknown): AttemptOutcome {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("request timed out")) return "timeout";
  if (message.includes("returned empty output")) return "empty";
  if (/\b(400|401|403|404|409|422)\b/.test(message)) return "rejected";
  return "transport";
}

export function configuredProviders(): Record<ProviderName, boolean> {
  return Object.fromEntries(
    PROVIDER_ORDER.map(provider => [provider, Boolean(getCredentials(provider))]),
  ) as Record<ProviderName, boolean>;
}

export function providerOrder(): ProviderName[] {
  const configured = configuredProviders();
  return PROVIDER_ORDER.filter(provider => configured[provider]);
}

export function modelRegistry(): Record<ProviderName, string[]> {
  return Object.fromEntries(
    PROVIDER_ORDER.map(provider => [provider, [...getConfiguredModels(provider)]]),
  ) as Record<ProviderName, string[]>;
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
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://agent-eval-router.vercel.app";
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "Agent Eval Router";
    }

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      stream: false,
    };
    if (provider !== "gemini") {
      requestBody.temperature = 0.1;
      requestBody.top_p = 0.7;
    }

    const response = await fetch(getEndpoint(provider), {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${provider} ${response.status}: ${body.slice(0, 300)}`);

    const parsed: unknown = JSON.parse(body);
    if (!isProviderResponse(parsed)) throw new Error(`${provider} returned an invalid response`);

    const output = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!output) throw new Error(`${provider} returned empty output`);

    const usage = parsed.usage ?? {};
    return {
      provider,
      model,
      output,
      latencyMs: Math.round(performance.now() - started),
      inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
      outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
      totalTokens: Number(usage.total_tokens ?? 0),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${provider} request timed out`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function runProviderCascade(
  messages: Message[],
  maxTokens = 100,
  options: CascadeOptions = {},
) {
  const started = performance.now();
  const attempts: AttemptResult[] = [];
  const attemptTimeoutMs = options.attemptTimeoutMs ?? envPositiveInt("PROVIDER_ATTEMPT_TIMEOUT_MS", DEFAULT_ATTEMPT_TIMEOUT_MS);
  const totalDeadlineMs = options.totalDeadlineMs ?? envPositiveInt("PROVIDER_TOTAL_DEADLINE_MS", DEFAULT_TOTAL_DEADLINE_MS);
  const maxModelsPerProvider = options.maxModelsPerProvider ?? Number.POSITIVE_INFINITY;

  outer: for (const provider of providerOrder()) {
    const models = getConfiguredModels(provider).slice(0, maxModelsPerProvider);
    for (const model of models) {
      const elapsed = performance.now() - started;
      if (elapsed >= totalDeadlineMs || elapsed + attemptTimeoutMs > totalDeadlineMs) break outer;

      const attemptStarted = performance.now();
      try {
        const result = await callProvider(provider, model, messages, maxTokens, attemptTimeoutMs);
        attempts.push({ provider, model, outcome: "success", latencyMs: result.latencyMs });
        return { result, attempts, exhausted: false };
      } catch (error) {
        attempts.push({
          provider,
          model,
          outcome: classifyFailure(error),
          latencyMs: Math.round(performance.now() - attemptStarted),
        });
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
