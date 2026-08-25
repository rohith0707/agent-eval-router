import { NextResponse } from "next/server";
import benchmarkCases from "@/benchmarks/routing-bench-v1.json";
import { db, databaseConfigured } from "@/lib/db";
import { average, p95, rate } from "@/lib/metrics";
import { AttemptResult, runProviderCascade } from "@/lib/providers";
import { BENCHMARK_GRADER_VERSION, gradeBenchmarkCase, type BenchmarkCase } from "@/lib/benchmark-grader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BENCHMARK_ATTEMPT_TIMEOUT_MS = 3000;
const BENCHMARK_CASE_DEADLINE_MS = 10000;
const BENCHMARK_CONCURRENCY = 10;
const BENCHMARK_MAX_MODELS_PER_PROVIDER = 2;
const BENCHMARK_COST_FIRST = true;

type BenchmarkStatus = "passed" | "failed" | "infra_failed";
type BenchmarkResult = {
  id: string;
  category: string;
  status: BenchmarkStatus;
  quality: number;
  latencyMs: number | null;
  provider: string | null;
  model: string | null;
  fallbacks: number;
  attempts: AttemptResult[];
  output?: string;
  evaluation?: ReturnType<typeof gradeBenchmarkCase>;
};

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
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

function promptFor(item: BenchmarkCase) {
  return [
    {
      role: "system" as const,
      content:
        "You are being evaluated on a fixed production benchmark. Follow the task exactly. Be concise and do not invent facts.",
    },
    { role: "user" as const, content: item.task },
  ];
}

export async function POST() {
  try {
    const cases = benchmarkCases as BenchmarkCase[];
    if (cases.length !== 50) {
      return NextResponse.json({ error: "Benchmark suite must contain exactly 50 cases." }, { status: 500 });
    }

    const smoke = await runProviderCascade(promptFor(cases[0]), 120, {
      attemptTimeoutMs: BENCHMARK_ATTEMPT_TIMEOUT_MS,
      totalDeadlineMs: BENCHMARK_CASE_DEADLINE_MS,
      maxModelsPerProvider: BENCHMARK_MAX_MODELS_PER_PROVIDER,
      costFirst: BENCHMARK_COST_FIRST,
    });

    if (!smoke.result) {
      return NextResponse.json(
        {
          error: "Provider preflight failed. No configured model produced a response, so the benchmark was not run.",
          smoke: { attempts: smoke.attempts },
          graderVersion: BENCHMARK_GRADER_VERSION,
        },
        { status: 503 },
      );
    }

    const started = performance.now();
    const results = await mapWithConcurrency(cases, BENCHMARK_CONCURRENCY, async (item) => {
      const cascade = await runProviderCascade(promptFor(item), 120, {
        attemptTimeoutMs: BENCHMARK_ATTEMPT_TIMEOUT_MS,
        totalDeadlineMs: BENCHMARK_CASE_DEADLINE_MS,
        maxModelsPerProvider: BENCHMARK_MAX_MODELS_PER_PROVIDER,
        costFirst: BENCHMARK_COST_FIRST,
      });

      if (!cascade.result) {
        return {
          id: item.id,
          category: item.category,
          status: "infra_failed" as const,
          quality: 0,
          latencyMs: null,
          provider: null,
          model: null,
          fallbacks: cascade.attempts.length,
          attempts: cascade.attempts,
        } satisfies BenchmarkResult;
      }

      const evaluation = gradeBenchmarkCase(item, cascade.result.output);
      return {
        id: item.id,
        category: item.category,
        status: evaluation.passed ? "passed" : "failed",
        quality: evaluation.quality,
        latencyMs: cascade.result.latencyMs,
        provider: cascade.result.provider,
        model: cascade.result.model,
        fallbacks: cascade.attempts.filter((attempt) => attempt.outcome !== "success").length,
        attempts: cascade.attempts,
        output: cascade.result.output,
        evaluation,
      } satisfies BenchmarkResult;
    });

    let persisted = 0;
    if (databaseConfigured()) {
      try {
        const data = results.map((result) => ({
          externalId: `bench_${Date.now()}_${result.id}`,
          task: result.id,
          status: result.status === "passed" ? "passed" : "failed",
          selectedModel: result.model ?? "unresolved",
          reason: `50-case benchmark · ${result.category} · ${result.evaluation?.mode ?? "infrastructure"}`,
          quality: result.quality,
          latencyMs: result.latencyMs ?? 0,
          cost: 0,
          reliability: result.status === "passed" ? 1 : 0,
          candidatesJson: result.attempts,
          traceJson: [
            { step: "Benchmark case", status: result.status, detail: result.id },
            {
              step: "Provider cascade",
              status: result.status,
              detail: result.model ? `${result.provider} / ${result.model}` : "No candidate succeeded",
            },
            ...(result.evaluation
              ? [{
                  step: "Task-specific grader",
                  status: result.evaluation.passed ? "passed" : "failed",
                  detail: `${result.evaluation.graderVersion} · ${result.evaluation.reason}`,
                }]
              : []),
          ],
        }));
        persisted = (await db.evaluationRun.createMany({ data })).count;
      } catch (error) {
        console.error("Benchmark persistence failed", error);
      }
    }

    const passed = results.filter((result) => result.status === "passed");
    const evaluatedFailures = results.filter((result) => result.status === "failed");
    const infraFailures = results.filter((result) => result.status === "infra_failed");
    const providerMix = Object.fromEntries(
      [...new Set(results.map((result) => result.provider).filter(Boolean))].map((provider) => [
        provider,
        results.filter((result) => result.provider === provider).length,
      ]),
    );

    return NextResponse.json({
      suite: { name: "routing-bench-v1", cases: 50 },
      graderVersion: BENCHMARK_GRADER_VERSION,
      durationMs: Math.round(performance.now() - started),
      summary: {
        passed: passed.length,
        failed: evaluatedFailures.length,
        infraFailed: infraFailures.length,
        evaluated: results.length - infraFailures.length,
        averageQuality: Number((average(results.filter((result) => result.status !== "infra_failed").map((result) => result.quality)) ?? 0).toFixed(3)),
        passedQuality: Number((average(passed.map((result) => result.quality)) ?? 0).toFixed(3)),
        p95LatencyMs: p95(passed.map((result) => result.latencyMs ?? 0)),
        fallbackRate: Number((rate(results.filter((result) => result.fallbacks > 0).length, results.length) ?? 0).toFixed(3)),
        persisted,
      },
      providerMix,
      byCategory: Object.fromEntries(
        [...new Set(results.map((result) => result.category))].map((category) => {
          const categoryResults = results.filter((result) => result.category === category);
          const evaluated = categoryResults.filter((result) => result.status !== "infra_failed");
          return [
            category,
            {
              cases: categoryResults.length,
              evaluated: evaluated.length,
              passed: categoryResults.filter((result) => result.status === "passed").length,
              infraFailed: categoryResults.filter((result) => result.status === "infra_failed").length,
              quality: Number((average(evaluated.map((result) => result.quality)) ?? 0).toFixed(3)),
              graderVersion: BENCHMARK_GRADER_VERSION,
            },
          ];
        }),
      ),
      failures: [...evaluatedFailures, ...infraFailures].slice(0, 10).map((result) => ({
        id: result.id,
        category: result.category,
        status: result.status,
        grader: result.evaluation
          ? {
              version: result.evaluation.graderVersion,
              mode: result.evaluation.mode,
              reason: result.evaluation.reason,
            }
          : null,
        attempts: result.attempts,
      })),
    });
  } catch (error) {
    console.error("Benchmark run failed", error);
    return NextResponse.json({ error: "Benchmark could not be completed." }, { status: 503 });
  }
}
