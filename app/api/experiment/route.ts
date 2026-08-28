import { NextResponse } from "next/server";
import benchmarkCases from "@/benchmarks/routing-bench-v1.json";
import { db, databaseConfigured } from "@/lib/db";
import { runExperimentCase, summarizeStrategy, type ExperimentCaseResult, type ExperimentStrategy } from "@/lib/experiment";
import type { BenchmarkCase } from "@/lib/benchmark-grader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXPERIMENT_CONCURRENCY = 5;
const STRATEGIES: readonly ExperimentStrategy[] = ["baseline", "cheapest", "adaptive"];

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

function relativeDelta(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline === 0) return null;
  return Number(((current - baseline) / Math.abs(baseline)).toFixed(3));
}

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({ experiment: null, warning: "Persistence is not configured; run an experiment to create a comparison." });
  }

  const latest = await db.evaluationRun.findFirst({
    where: { externalId: { startsWith: "experiment_summary_" } },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return NextResponse.json({ experiment: null });

  return NextResponse.json({ experiment: latest.traceJson });
}

export async function POST() {
  const cases = benchmarkCases as BenchmarkCase[];
  if (cases.length !== 50) {
    return NextResponse.json({ error: "Experiment suite must contain exactly 50 cases." }, { status: 500 });
  }

  const started = performance.now();
  const experimentId = `${Date.now()}`;
  const results: ExperimentCaseResult[] = [];

  for (const item of cases) {
    const caseResults = await Promise.all(STRATEGIES.map((strategy) => runExperimentCase(item, strategy)));
    results.push(...caseResults);
  }

  const summaries = STRATEGIES.map((strategy) => summarizeStrategy(results, strategy));
  const baseline = summaries.find((summary) => summary.strategy === "baseline")!;
  const adaptive = summaries.find((summary) => summary.strategy === "adaptive")!;
  const cheapest = summaries.find((summary) => summary.strategy === "cheapest")!;

  const comparison = {
    adaptiveVsBaseline: {
      taskSuccessRateDelta: relativeDelta(adaptive.taskSuccessRate, baseline.taskSuccessRate),
      qualityDelta: relativeDelta(adaptive.averageQuality, baseline.averageQuality),
      latencyDelta: relativeDelta(adaptive.p95LatencyMs, baseline.p95LatencyMs),
      costPerSuccessfulTaskDelta: relativeDelta(adaptive.costPerSuccessfulTaskUsd, baseline.costPerSuccessfulTaskUsd),
      availabilityDelta: relativeDelta(adaptive.availability, baseline.availability),
    },
    adaptiveVsCheapest: {
      taskSuccessRateDelta: relativeDelta(adaptive.taskSuccessRate, cheapest.taskSuccessRate),
      qualityDelta: relativeDelta(adaptive.averageQuality, cheapest.averageQuality),
      latencyDelta: relativeDelta(adaptive.p95LatencyMs, cheapest.p95LatencyMs),
      costPerSuccessfulTaskDelta: relativeDelta(adaptive.costPerSuccessfulTaskUsd, cheapest.costPerSuccessfulTaskUsd),
      availabilityDelta: relativeDelta(adaptive.availability, cheapest.availability),
    },
  };

  let persisted = 0;
  if (databaseConfigured()) {
    try {
      const data = results.map((result) => ({
        externalId: `experiment_${experimentId}_${result.strategy}_${result.caseId}`,
        task: result.caseId,
        status: result.status === "passed" ? "passed" : "failed",
        selectedModel: result.model ?? "unresolved",
        reason: `Experiment ${result.strategy} · ${result.rationale}`,
        quality: result.quality,
        latencyMs: result.latencyMs ?? 0,
        cost: result.costUsd,
        reliability: result.status === "infra_failed" ? 0 : 1,
        candidatesJson: result.attempts,
        traceJson: [
          { step: "Experiment strategy", status: "recorded", detail: result.strategy },
          { step: "Task", status: "recorded", detail: result.caseId },
          { step: "Rationale", status: "recorded", detail: result.rationale },
          { step: "Actual output", status: result.output ? "recorded" : "unavailable", detail: result.output ?? "No model response" },
        ],
      }));
      persisted = (await db.evaluationRun.createMany({ data })).count;

      await db.evaluationRun.create({
        data: {
          externalId: `experiment_summary_${experimentId}`,
          task: "EXPERIMENT_SUMMARY",
          status: "completed",
          selectedModel: "multi-strategy",
          reason: "Fixed vs Cheapest vs Adaptive comparison",
          quality: adaptive.averageQuality ?? 0,
          latencyMs: adaptive.p95LatencyMs ?? 0,
          cost: adaptive.costPerSuccessfulTaskUsd ?? 0,
          reliability: adaptive.availability ?? 0,
          candidatesJson: summaries,
          traceJson: {
            experimentId,
            suite: "routing-bench-v1",
            cases: 50,
            durationMs: Math.round(performance.now() - started),
            summaries,
            comparison,
            persisted,
          },
        },
      });
      persisted += 1;
    } catch (error) {
      console.error("Experiment persistence failed", error);
    }
  }

  return NextResponse.json({
    experimentId,
    suite: { name: "routing-bench-v1", cases: 50 },
    durationMs: Math.round(performance.now() - started),
    summaries,
    comparison,
    persisted,
    note: "Adaptive policy is deterministic in this release; the next release will learn weights from persisted evidence.",
  });
}
