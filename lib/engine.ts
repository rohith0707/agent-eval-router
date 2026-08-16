export type Candidate = { model: string; quality: number; latencyMs: number; cost: number; reliability: number };

export const candidates: Candidate[] = [
  { model: "meta/llama-3.3-70b-instruct", quality: 0, latencyMs: 0, cost: 0, reliability: 0 },
  { model: "openai/gpt-oss-120b", quality: 0, latencyMs: 0, cost: 0, reliability: 0 },
  { model: "nvidia/llama-3.3-nemotron-super-49b-v1.5", quality: 0, latencyMs: 0, cost: 0, reliability: 0 },
];

export function route(task: string, qualityThreshold = 0.9, latencyBudgetMs = 2500, costBudget = 0.03, observed: Candidate[] = candidates) {
  const eligible = observed.filter(
    (m) => m.quality >= qualityThreshold && m.latencyMs <= latencyBudgetMs && m.cost <= costBudget && m.reliability > 0,
  );
  const successful = observed.filter((m) => m.reliability > 0);
  const pool = eligible.length ? eligible : successful.length ? successful : observed;
  const selected = [...pool].sort((a, b) => b.quality - a.quality || a.latencyMs - b.latencyMs)[0];
  const passed = eligible.some((m) => m.model === selected.model);
  const reason = passed
    ? `Selected ${selected.model}: highest observed quality satisfying quality >= ${(qualityThreshold * 100).toFixed(0)}%, latency <= ${latencyBudgetMs}ms, and cost <= $${costBudget.toFixed(3)}.`
    : `No candidate satisfied every constraint; ${selected.model} was selected as the highest-quality successful fallback.`;
  return { selected, eligible, passed, reason, task };
}
