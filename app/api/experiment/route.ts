import { NextResponse } from "next/server";
import benchmarkCases from "@/benchmarks/routing-bench-v1.json";
import { db, databaseConfigured } from "@/lib/db";
import { runExperimentCase, summarizeStrategy, type ExperimentStrategy } from "@/lib/experiment";
import { normalizeExperimentBatch, TOTAL_EXPERIMENT_CASES } from "@/lib/experiment-batching";
import type { BenchmarkCase } from "@/lib/benchmark-grader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXPERIMENT_CONCURRENCY = 6;
const STRATEGIES: readonly ExperimentStrategy[] = ["baseline", "cheapest", "adaptive"];

type WorkItem = { item: BenchmarkCase; strategy: ExperimentStrategy };

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

function parseBatch(request: Request) {
  const url = new URL(request.url);
  const start = Number(url.searchParams.get("start") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "10");
  return normalizeExperimentBatch(start, limit);
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

export async function POST(request: Request) {
  const cases = benchmarkCases as BenchmarkCase[];
  if (cases.length !== TOTAL_EXPERIMENT_CASES) {
    return NextResponse.json({ error: `Experiment suite must contain exactly ${TOTAL_EXPERIMENT_CASES} cases.` }, { status: 500 });
  }

  try {
    const batch = parseBatch(request);
    const batchCases = cases.slice(batch.start, batch.start + batch.limit);
    const started = performance.now();
    const experimentId = `${Date.now()}_${batch.start}`;
    const work: WorkItem[] = batchCases.flatMap((item) => STRATEGIES.map((strategy) => ({ item, strategy })));
    const results = await mapWithConcurrency(work, EXPERIMENT_CONCURRENCY, ({ item, strategy }) => runExperimentCase(item, strategy));
    const summaries = STRATEGIES.map((strategy) => summarizeStrategy(results, strategy));

    let persisted = 0;
    if (databaseConfigured()) {
      try {
        const data = results.map((result) => ({
          externalId: `experiment_${experimentId}_${result.strategy}_${result.caseId}`,
          task: result.caseId,
          status: result.status === "passed" ? "passed" : "failed",
          selectedModel: result.model ?? "unresolved",
          reason: `Experiment batch ${batch.start}-${batch.start + batch.limit - 1} · ${result.strategy} · ${result.rationale}`,
          quality: result.quality,
          latencyMs: result.latencyMs ?? 0,
          cost: result.costUsd,
          reliability: result.status === "infra_failed" ? 0 : 1,
          candidatesJson: result.attempts,
          traceJson: [
            { step: "Experiment strategy", status: "recorded", detail: result.strategy },
            { step: "Experiment batch", status: "recorded", detail: `${batch.start}:${batch.start + batch.limit}` },
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
            quality: summaries.find((s) => s.strategy === "adaptive")?.averageQuality ?? 0,
            latencyMs: summaries.find((s) => s.strategy === "adaptive")?.p95LatencyMs ?? 0,
            cost: summaries.find((s) => s.strategy === "adaptive")?.costPerSuccessfulTaskUsd ?? 0,
            reliability: summaries.find((s) => s.strategy === "adaptive")?.availability ?? 0,
            candidatesJson: summaries,
            traceJson: {
              experimentId,
              suite: "routing-bench-v1",
              batch,
              summaries,
            },
          },
        });
        persisted += 1;
      } catch (error) {
        console.error("Experiment batch persistence failed", error);
      }
    }

    const baseline = summaries.find((summary) => summary.strategy === "baseline")!;
    const adaptive = summaries.find((summary) => summary.strategy === "adaptive")!;
    const cheapest = summaries.find((summary) => summary.strategy === "cheapest")!;

    return NextResponse.json({
      experimentId,
      suite: { name: "routing-bench-v1", cases: TOTAL_EXPERIMENT_CASES },
      batch,
      durationMs: Math.round(performance.now() - started),
      summaries,
      comparison: {
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
      },
      persisted,
      note: "Execute the five 10-case batches and aggregate their raw results for a complete 50-case comparison. Batch summaries are not a substitute for the full-suite comparison.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid experiment batch." }, { status: 400 });
  }
}
