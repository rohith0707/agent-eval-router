import { NextResponse } from "next/server";
import benchmarkCases from "@/benchmarks/routing-bench-v1.json";
import { db, databaseConfigured } from "@/lib/db";
import { deterministicGrade, runProviderCascade } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BENCHMARK_ATTEMPT_TIMEOUT_MS = 1400;
const BENCHMARK_CASE_DEADLINE_MS = 5000;
const BENCHMARK_CONCURRENCY = 10;
const BENCHMARK_MAX_MODELS_PER_PROVIDER = 1;

function scoreBenchmark(task: string, expected: string, output: string) {
  const expectedWords = new Set(expected.toLowerCase().split(/[^a-z0-9$]+/).filter((w) => w.length > 2));
  const outputWords = new Set(output.toLowerCase().split(/[^a-z0-9$]+/).filter((w) => w.length > 2));
  let overlap = 0;
  for (const word of expectedWords) if (outputWords.has(word)) overlap++;
  const overlapScore = expectedWords.size ? overlap / expectedWords.size : 0;
  const rubric = deterministicGrade(task, output);
  return Number((0.6 * overlapScore + 0.4 * rubric.quality).toFixed(3));
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;

  async function runner() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

export async function POST() {
  try {
    const cases = benchmarkCases as Array<{
      id: string;
      category: string;
      difficulty: string;
      task: string;
      expected_behavior: string;
    }>;

    if (cases.length !== 50) {
      return NextResponse.json({ error: "Benchmark suite must contain exactly 50 cases." }, { status: 500 });
    }

    const started = performance.now();
    const results = await mapWithConcurrency(cases, BENCHMARK_CONCURRENCY, async (item) => {
      const cascade = await runProviderCascade(
        [
          {
            role: "system",
            content: "You are being evaluated on a fixed production benchmark. Follow the task exactly. Be concise and do not invent facts.",
          },
          { role: "user", content: item.task },
        ],
        120,
        {
          attemptTimeoutMs: BENCHMARK_ATTEMPT_TIMEOUT_MS,
          totalDeadlineMs: BENCHMARK_CASE_DEADLINE_MS,
          maxModelsPerProvider: BENCHMARK_MAX_MODELS_PER_PROVIDER,
        },
      );

      if (!cascade.result) {
        return {
          id: item.id,
          category: item.category,
          status: "failed" as const,
          quality: 0,
          latencyMs: null,
          provider: null,
          model: null,
          fallbacks: cascade.attempts.length,
          attempts: cascade.attempts,
        };
      }

      const quality = scoreBenchmark(item.task, item.expected_behavior, cascade.result.output);
      return {
        id: item.id,
        category: item.category,
        status: "passed" as const,
        quality,
        latencyMs: cascade.result.latencyMs,
        provider: cascade.result.provider,
        model: cascade.result.model,
        fallbacks: cascade.attempts.filter((attempt) => attempt.outcome !== "success").length,
        attempts: cascade.attempts,
        output: cascade.result.output,
      };
    });

    let persisted = 0;
    if (databaseConfigured()) {
      for (const result of results) {
        try {
          await db.evaluationRun.create({
            data: {
              externalId: `bench_${Date.now()}_${result.id}`,
              task: result.id,
              status: result.status,
              selectedModel: result.model ?? "unresolved",
              reason: `50-case benchmark · ${result.category}`,
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
              ],
            },
          });
          persisted++;
        } catch {
          // Evidence persistence must not invalidate the benchmark result.
        }
      }
    }

    const passed = results.filter((result) => result.status === "passed");
    const failed = results.filter((result) => result.status !== "passed");
    const latencies = passed.map((result) => result.latencyMs ?? 0).sort((a, b) => a - b);
    const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] : null;
    const averageQuality = passed.length ? passed.reduce((sum, result) => sum + result.quality, 0) / passed.length : 0;
    const fallbackRate = results.length ? results.filter((result) => result.fallbacks > 0).length / results.length : 0;
    const providerMix = Object.fromEntries(
      [...new Set(results.map((result) => result.provider).filter(Boolean))].map((provider) => [
        provider,
        results.filter((result) => result.provider === provider).length,
      ]),
    );

    return NextResponse.json({
      suite: { name: "routing-bench-v1", cases: 50 },
      durationMs: Math.round(performance.now() - started),
      summary: {
        passed: passed.length,
        failed: failed.length,
        averageQuality: Number(averageQuality.toFixed(3)),
        p95LatencyMs: p95,
        fallbackRate: Number(fallbackRate.toFixed(3)),
        persisted,
      },
      providerMix,
      byCategory: Object.fromEntries(
        [...new Set(results.map((result) => result.category))].map((category) => {
          const categoryResults = results.filter((result) => result.category === category);
          return [
            category,
            {
              cases: categoryResults.length,
              passed: categoryResults.filter((result) => result.status === "passed").length,
              quality: Number(
                (categoryResults.reduce((sum, result) => sum + result.quality, 0) / categoryResults.length).toFixed(3),
              ),
            },
          ];
        }),
      ),
      failures: failed.slice(0, 10).map((result) => ({ id: result.id, category: result.category, attempts: result.attempts })),
    });
  } catch (error) {
    console.error("Benchmark run failed", error);
    return NextResponse.json({ error: "Benchmark could not be completed." }, { status: 503 });
  }
}
