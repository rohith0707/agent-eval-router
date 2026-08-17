export type Candidate = Readonly<{
  model: string;
  quality: number;
  latencyMs: number;
  cost: number;
  reliability: number;
}>;

// Legacy preview candidates are intentionally kept for `/api/evaluate`.
// Live inference uses observed metrics from the provider cascade instead.
export const candidates: readonly Candidate[] = Object.freeze([
  { model: "meta/llama-3.3-70b-instruct", quality: 0, latencyMs: 0, cost: 0, reliability: 0 },
  { model: "openai/gpt-oss-120b", quality: 0, latencyMs: 0, cost: 0, reliability: 0 },
  { model: "nvidia/llama-3.3-nemotron-super-49b-v1.5", quality: 0, latencyMs: 0, cost: 0, reliability: 0 },
]);

type RoutingDecision = {
  selected: Candidate;
  eligible: Candidate[];
  passed: boolean;
  reason: string;
  task: string;
};

export function route(
  task: string,
  qualityThreshold = 0.9,
  latencyBudgetMs = 2500,
  costBudget = 0.03,
  observed: readonly Candidate[] = candidates,
): RoutingDecision {
  const eligible = observed.filter(
    candidate =>
      candidate.quality >= qualityThreshold &&
      candidate.latencyMs <= latencyBudgetMs &&
      candidate.cost <= costBudget &&
      candidate.reliability > 0,
  );
  const successful = observed.filter(candidate => candidate.reliability > 0);
  const pool = eligible.length > 0 ? eligible : successful.length > 0 ? successful : [...observed];
  const selected = [...pool].sort(
    (a, b) => b.quality - a.quality || a.latencyMs - b.latencyMs,
  )[0];

  if (!selected) {
    throw new Error("Routing requires at least one candidate");
  }

  const passed = eligible.some(candidate => candidate.model === selected.model);
  const reason = passed
    ? `Selected ${selected.model}: highest observed quality satisfying quality >= ${(qualityThreshold * 100).toFixed(0)}%, latency <= ${latencyBudgetMs}ms, and cost <= $${costBudget.toFixed(3)}.`
    : `No candidate satisfied every constraint; ${selected.model} was selected as the highest-quality successful fallback.`;

  return { selected, eligible, passed, reason, task };
}
