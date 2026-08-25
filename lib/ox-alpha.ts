import { getOpenRouterApiKey } from "@/lib/config";

export const OX_ALPHA_MODEL = "stealth/ox-alpha";
const OX_ALPHA_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type OxAlphaResult = {
  model: string;
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
  };
};

type HttpError = Error & { statusCode?: number; detail?: string };

export function isLongHorizonTask(task: string): boolean {
  const text = task.toLowerCase();
  return text.length >= 12_000 || /codebase|repository|repo|refactor|debug|architecture|agentic|agent|tool call|long[- ]horizon|multi[- ]step|migration|pull request|pr review|system design/.test(text);
}

function sanitizeDetail(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,}]+/gi, "Bearer [redacted]")
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function parseResponse(value: unknown): ProviderResponse {
  if (!value || typeof value !== "object") throw new Error("Ox Alpha returned an invalid response");
  return value as ProviderResponse;
}

export async function runOxAlpha(messages: Array<{ role: "system" | "user"; content: string }>, maxTokens = 1200, timeoutMs = 8_000): Promise<OxAlphaResult> {
  const key = getOpenRouterApiKey();
  if (!key) throw new Error("OpenRouter credentials are not configured");

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OX_ALPHA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://agent-eval-router.vercel.app",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Agent Eval Router",
      },
      body: JSON.stringify({
        model: OX_ALPHA_MODEL,
        messages,
        max_tokens: maxTokens,
        stream: false,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`Ox Alpha ${response.status}: ${sanitizeDetail(body)}`) as HttpError;
      error.statusCode = response.status;
      error.detail = sanitizeDetail(body);
      throw error;
    }

    const parsed = parseResponse(JSON.parse(body));
    const output = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!output) throw new Error("Ox Alpha returned empty output");

    const usage = parsed.usage ?? {};
    const inputTokens = Number(usage.prompt_tokens ?? 0);
    const outputTokens = Number(usage.completion_tokens ?? 0);
    const reasoningTokens = Number(usage.reasoning_tokens ?? 0);
    const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens + reasoningTokens);

    return {
      model: OX_ALPHA_MODEL,
      output,
      latencyMs: Math.round(performance.now() - started),
      inputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("Ox Alpha request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
