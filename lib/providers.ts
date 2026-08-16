import { getNvidiaApiKey } from "@/lib/config";

export type ProviderName = "gemini" | "huggingface" | "nvidia" | "openrouter";
export type Message = { role: "system" | "user"; content: string };
export type ProviderResult = { provider: ProviderName; model: string; output: string; latencyMs: number; inputTokens: number; outputTokens: number; totalTokens: number };
export type AttemptResult = { provider: ProviderName; model: string; outcome: "success" | "timeout" | "rejected" | "empty" | "transport"; latencyMs: number };

const ATTEMPT_TIMEOUT_MS = Number(process.env.PROVIDER_ATTEMPT_TIMEOUT_MS ?? 3500);
const TOTAL_DEADLINE_MS = Number(process.env.PROVIDER_TOTAL_DEADLINE_MS ?? 50000);

/**
 * Internal model catalog.
 * Users configure ONE key per provider. They never need to know or configure
 * individual model IDs. Provider-specific model failures are handled internally.
 *
 * The order is intentionally cheap/fast first, then progressively stronger models.
 */
const MODEL_REGISTRY: Record<ProviderName, string[]> = {
  gemini: [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
  ],
  huggingface: [
    "Qwen/Qwen3-8B",
    "google/gemma-3-4b-it",
    "meta-llama/Llama-3.2-3B-Instruct",
  ],
  nvidia: [
    "meta/llama-3.2-1b-instruct",
    "meta/llama-3.2-3b-instruct",
    "meta/llama-3.1-8b-instruct",
  ],
  // openrouter/free dynamically selects from the currently available free pool.
  // This is intentionally preferred to hard-coding volatile free model slugs.
  openrouter: ["openrouter/free"],
};

function getCredentials(provider: ProviderName): string | undefined {
  switch (provider) {
    case "gemini": return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    case "huggingface": return process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
    case "nvidia": return getNvidiaApiKey();
    case "openrouter": return process.env.OPENROUTER_API_KEY;
  }
}

function getConfiguredModels(provider: ProviderName): string[] {
  // Optional server-side override for operations teams; never exposed to users.
  const envName = `${provider.toUpperCase()}_MODELS`;
  const override = process.env[envName];
  if (override) return override.split(",").map(v => v.trim()).filter(Boolean);
  return MODEL_REGISTRY[provider];
}

export function configuredProviders(): Record<ProviderName, boolean> {
  return {
    gemini: Boolean(getCredentials("gemini")),
    huggingface: Boolean(getCredentials("huggingface")),
    nvidia: Boolean(getCredentials("nvidia")),
    openrouter: Boolean(getCredentials("openrouter")),
  };
}

export function providerOrder(): ProviderName[] {
  const configured = configuredProviders();
  return (["gemini", "huggingface", "nvidia", "openrouter"] as ProviderName[]).filter(p => configured[p]);
}

export function modelRegistry() {
  return Object.fromEntries(
    (Object.keys(MODEL_REGISTRY) as ProviderName[]).map(provider => [provider, getConfiguredModels(provider)])
  ) as Record<ProviderName, string[]>;
}

function getEndpoint(provider: ProviderName): string {
  switch (provider) {
    case "gemini": return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    case "huggingface": return "https://router.huggingface.co/v1/chat/completions";
    case "nvidia": return "https://integrate.api.nvidia.com/v1/chat/completions";
    case "openrouter": return "https://openrouter.ai/api/v1/chat/completions";
  }
}

function classifyFailure(error: unknown): AttemptResult["outcome"] {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timed out")) return "timeout";
  if (message.includes("returned empty")) return "empty";
  if (/\b(400|401|403|404|409|422)\b/.test(message)) return "rejected";
  return "transport";
}

export async function callProvider(provider: ProviderName, model: string, messages: Message[], maxTokens = 100): Promise<ProviderResult> {
  const key = getCredentials(provider);
  if (!key) throw new Error(`${provider} credentials are not configured`);
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://agent-eval-router.vercel.app";
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "Agent Eval Router";
    }

    const requestBody: Record<string, unknown> = { model, messages, max_tokens: maxTokens, stream: false };
    if (provider !== "gemini") {
      requestBody.temperature = 0.1;
      requestBody.top_p = 0.7;
    }

    const response = await fetch(getEndpoint(provider), {
      method: "POST", headers,
      body: JSON.stringify(requestBody),
      cache: "no-store", signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${provider} ${response.status}: ${body.slice(0, 300)}`);

    let json: any;
    try { json = JSON.parse(body); } catch { throw new Error(`${provider} returned non-JSON`); }
    const usage = json.usage ?? {};
    const output = json.choices?.[0]?.message?.content ?? "";
    if (!output.trim()) throw new Error(`${provider} returned empty output`);

    return {
      provider, model, output,
      latencyMs: Math.round(performance.now() - started),
      inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
      outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
      totalTokens: Number(usage.total_tokens ?? 0),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error(`${provider} request timed out`);
    throw error;
  } finally { clearTimeout(timer); }
}

/**
 * Production serving policy:
 * - Try every configured model in deterministic priority order until one works.
 * - Missing provider keys are skipped automatically.
 * - Provider/model errors stay server-side; callers receive only the successful answer.
 * - If everything fails, return a generic service-unavailable state, never raw API errors.
 */
export async function runProviderCascade(messages: Message[], maxTokens = 100) {
  const started = performance.now();
  const attempts: AttemptResult[] = [];

  for (const provider of providerOrder()) {
    for (const model of getConfiguredModels(provider)) {
      if (performance.now() - started + ATTEMPT_TIMEOUT_MS > TOTAL_DEADLINE_MS) break;
      const attemptStarted = performance.now();
      try {
        const result = await callProvider(provider, model, messages, maxTokens);
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
