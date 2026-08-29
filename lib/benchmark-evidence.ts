export type BenchmarkObservation = {
  caseId: string;
  category: string;
  model: string;
  passed: boolean;
  latencyMs: number;
  costUsd: number;
  fallback: boolean;
};

export type BenchmarkModelSummary = {
  model: string;
  cases: number;
  taskSuccess: number;
  quality: number;
  p95LatencyMs: number;
  costPerTaskUsd: number;
  reliability: number;
  failureRate: number;
  fallbackRate: number;
};

export function summarizeBenchmark(observations: BenchmarkObservation[]): BenchmarkModelSummary[] {
  if (observations.length === 0) throw new Error("Benchmark requires at least one observation");
  const models = [...new Set(observations.map((o) => o.model))];
  return models.map((model) => {
    const rows = observations.filter((o) => o.model === model);
    const passed = rows.filter((o) => o.passed).length;
    const sorted = rows.map((o) => o.latencyMs).sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95))];
    return {
      model,
      cases: rows.length,
      taskSuccess: passed / rows.length,
      quality: passed / rows.length,
      p95LatencyMs: p95,
      costPerTaskUsd: rows.reduce((sum, o) => sum + o.costUsd, 0) / rows.length,
      reliability: rows.length ? (rows.length - rows.filter((o) => o.fallback).length) / rows.length : 0,
      failureRate: (rows.length - passed) / rows.length,
      fallbackRate: rows.filter((o) => o.fallback).length / rows.length,
    };
  });
}
