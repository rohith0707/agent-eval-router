export type Candidate = { model: string; quality: number; latencyMs: number; cost: number; reliability: number };

export const candidates: Candidate[] = [
  { model: "GPT-5", quality: 0.918, latencyMs: 1420, cost: 0.014, reliability: 0.962 },
  { model: "Claude Sonnet", quality: 0.952, latencyMs: 1880, cost: 0.021, reliability: 0.971 },
  { model: "Local Llama", quality: 0.874, latencyMs: 760, cost: 0.002, reliability: 0.914 },
];

export function route(task: string, qualityThreshold = 0.9, latencyBudgetMs = 2500, costBudget = 0.03) {
  const eligible = candidates.filter(
    (m) => m.quality >= qualityThreshold && m.latencyMs <= latencyBudgetMs && m.cost <= costBudget,
  );
  const selected = [...(eligible.length ? eligible : candidates)].sort(
    (a, b) => b.quality - a.quality || a.latencyMs - b.latencyMs,
  )[0];
  const passed = eligible.some((m) => m.model === selected.model);
  const reason = passed
    ? `Selected ${selected.model}: highest quality among candidates satisfying quality >= ${(qualityThreshold * 100).toFixed(0)}%, latency <= ${latencyBudgetMs}ms, and cost <= $${costBudget.toFixed(3)}.`
    : `No candidate satisfied every constraint; ${selected.model} was selected as the highest-quality fallback.`;
  return { selected, eligible, passed, reason, task };
}
