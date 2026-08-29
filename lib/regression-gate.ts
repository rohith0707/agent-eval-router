export type BenchmarkRun = {
  caseId: string;
  category: string;
  passed: boolean;
  latencyMs?: number;
  costUsd?: number;
};

export type RegressionGateConfig = {
  minQuality: number;
  maxFailureRate: number;
  maxP95LatencyMs: number;
  maxCostPerRunUsd: number;
};

export type RegressionGateResult = {
  passed: boolean;
  quality: number;
  failureRate: number;
  p95LatencyMs: number;
  costPerRunUsd: number;
  failures: string[];
};

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95));
  return sorted[index];
}

export function evaluateRegressionGate(
  runs: BenchmarkRun[],
  config: RegressionGateConfig,
): RegressionGateResult {
  if (runs.length === 0) {
    throw new Error("Regression gate requires at least one benchmark result");
  }

  const passedCount = runs.filter((run) => run.passed).length;
  const failedCount = runs.length - passedCount;
  const quality = passedCount / runs.length;
  const failureRate = failedCount / runs.length;
  const p95LatencyMs = percentile95(runs.map((run) => run.latencyMs ?? 0));
  const costPerRunUsd = runs.reduce((sum, run) => sum + (run.costUsd ?? 0), 0) / runs.length;
  const failures: string[] = [];

  if (quality < config.minQuality) {
    failures.push(`quality ${quality.toFixed(4)} < minimum ${config.minQuality.toFixed(4)}`);
  }
  if (failureRate > config.maxFailureRate) {
    failures.push(`failure rate ${failureRate.toFixed(4)} > maximum ${config.maxFailureRate.toFixed(4)}`);
  }
  if (p95LatencyMs > config.maxP95LatencyMs) {
    failures.push(`p95 latency ${p95LatencyMs}ms > maximum ${config.maxP95LatencyMs}ms`);
  }
  if (costPerRunUsd > config.maxCostPerRunUsd) {
    failures.push(`cost/run $${costPerRunUsd.toFixed(6)} > maximum $${config.maxCostPerRunUsd.toFixed(6)}`);
  }

  return {
    passed: failures.length === 0,
    quality,
    failureRate,
    p95LatencyMs,
    costPerRunUsd,
    failures,
  };
}
