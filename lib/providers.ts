import { getNvidiaApiKey } from "@/lib/config";

export type ProviderName = "nvidia" | "huggingface" | "openrouter";
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

const TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS ?? 45000);

function getCredentials(provider: ProviderName): string | undefined {
  switch (provider) {
    case "nvidia":
      return getNvidiaApiKey();
    case "huggingface":
      return process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
  }
}

export function getProviderModel(provider: ProviderName): string {
  switch (provider) {
    case "nvidia":
      return process.env.NVIDIA_MODEL ?? "meta/llama-3.2-3b-instruct";
    case "huggingface":
      return process.env.HF_MODEL ?? "openai/gpt-oss-120b:groq";
    case "openrouter":
      return process.env.OPENROUTER_MODEL ?? "openai/gpt-chat-latest";
  }
}

function getEndpoint(provider: ProviderName): string {
  switch (provider) {
    case "nvidia":
      return "https://integrate.api.nvidia.com/v1/chat/completions";
    case "huggingface":
      return "https://router.huggingface.co/v1/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
  }
}

export function configuredProviders(): Record<ProviderName, boolean> {
  return {
    nvidia: Boolean(getCredentials("nvidia")),
    huggingface: Boolean(getCredentials("huggingface")),
    openrouter: Boolean(getCredentials("openrouter")),
  };
}

export async function callProvider(
  provider: ProviderName,
  messages: Message[],
  maxTokens = 160,
): Promise<ProviderResult> {
  const key = getCredentials(provider);
  if (!key) {
    throw new Error(`${provider} credentials are not configured on the server`);
  }

  const model = getProviderModel(provider);
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };

    if (provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL ?? "https://agent-eval-router.vercel.app";
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "Agent Eval Router";
    }

    const response = await fetch(getEndpoint(provider), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        top_p: 0.7,
        max_tokens: maxTokens,
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`${provider} ${response.status}: ${body.slice(0, 400)}`);
    }

    let json: any;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error(`${provider} returned non-JSON: ${body.slice(0, 250)}`);
    }

    const usage = json.usage ?? {};
    return {
      provider,
      model,
      output: json.choices?.[0]?.message?.content ?? "",
      latencyMs: Math.round(performance.now() - started),
      inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
      outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
      totalTokens: Number(usage.total_tokens ?? 0),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${provider} request timed out after ${TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
