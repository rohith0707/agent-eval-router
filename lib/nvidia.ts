import { getNvidiaApiKey } from "@/lib/config";

export type ChatMessage = { role: "system" | "user"; content: string };

export type NvidiaResult = {
  model: string;
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 8000;

export async function nvidiaChat(model: string, messages: ChatMessage[], maxTokens = 220): Promise<NvidiaResult> {
  const key = getNvidiaApiKey();
  if (!key) throw new Error("NVIDIA_API_KEY is not configured on the server. Add NVIDIA_API_KEY to the Vercel Production environment and redeploy.");
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: maxTokens }),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`NVIDIA ${response.status}: ${body.slice(0, 400)}`);
    let json: any;
    try { json = JSON.parse(body); } catch { throw new Error(`NVIDIA returned non-JSON: ${body.slice(0, 250)}`); }
    const usage = json.usage ?? {};
    return {
      model,
      output: json.choices?.[0]?.message?.content ?? "",
      latencyMs: Math.round(performance.now() - started),
      inputTokens: Number(usage.prompt_tokens ?? 0),
      outputTokens: Number(usage.completion_tokens ?? 0),
      totalTokens: Number(usage.total_tokens ?? 0),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`NVIDIA request timed out after ${REQUEST_TIMEOUT_MS}ms`);
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
    reason: `Deterministic demo grader: ${checks.filter(Boolean).length}/${checks.length} rubric checks passed.`,
  };
}
