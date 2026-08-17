import { NextResponse } from "next/server";
import benchmarkCases from "@/benchmarks/routing-bench-v1.json";
import { db, databaseConfigured } from "@/lib/db";
import { average, p95, rate } from "@/lib/metrics";
import { AttemptResult, runProviderCascade } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BENCHMARK_ATTEMPT_TIMEOUT_MS = 3000;
const BENCHMARK_CASE_DEADLINE_MS = 10000;
const BENCHMARK_CONCURRENCY = 10;
const BENCHMARK_MAX_MODELS_PER_PROVIDER = 1;

type BenchmarkCase = {
  id: string;
  category: string;
  difficulty: string;
  task: string;
  expected_behavior: string;
};

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
  evaluation?: {
    mode: "reference_match" | "structural" | "semantic_overlap";
    matchedSignals: number;
    totalSignals: number;
    reason: string;
  };
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/```(?:json|sql|python)?/g, " ").replace(/[^a-z0-9$%_.<>:=/-]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter(token => token.length > 1));
}

function hasAny(text: string, patterns: string[]): boolean {
  return patterns.some(pattern => text.includes(pattern));
}

function scoreByCategory(item: BenchmarkCase, output: string): BenchmarkResult["evaluation"] & { quality: number; passed: boolean } {
  const text = normalize(output);
  const expected = normalize(item.expected_behavior);

  if (item.category === "reasoning") {
    const signals = expected.split(/(?:,| with | that | and |;)/).map(value => value.trim()).filter(value => value.length >= 2);
    const meaningful = signals.slice(0, 4);
    const matched = meaningful.filter(signal => text.includes(signal)).length;
    const answerNumbers = (text.match(/\$?\d+(?:\.\d+)?%?/g) ?? []).length;
    const quality = Math.min(1, 0.75 * (matched / Math.max(1, meaningful.length)) + 0.25 * Math.min(1, answerNumbers / 1));
    return { quality: Number(quality.toFixed(3)), passed: quality >= 0.65, mode: "semantic_overlap", matchedSignals: matched, totalSignals: meaningful.length, reason: `Matched ${matched}/${meaningful.length} expected reasoning signals.` };
  }

  if (item.category === "structured_output") {
    const trimmed = output.trim();
    const looksJson = (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
    const forbiddenMarkdown = output.includes("```");
    const expectedSignals = expected.split(/\s+/).filter(token => token.length > 2).slice(0, 12);
    const matched = expectedSignals.filter(signal => text.includes(signal)).length;
    const quality = Math.min(1, 0.55 * (looksJson ? 1 : 0) + 0.2 * (!forbiddenMarkdown ? 1 : 0) + 0.25 * (matched / Math.max(1, expectedSignals.length)));
    return { quality: Number(quality.toFixed(3)), passed: quality >= 0.7, mode: "structural", matchedSignals: matched, totalSignals: expectedSignals.length, reason: `JSON structure=${looksJson}; markdown=${forbiddenMarkdown ? "present" : "absent"}.` };
  }

  if (item.category === "tool_calling") {
    const expectedSignals = expected.split(/(?: and |,|\.)/).map(value => value.trim()).filter(Boolean);
    const matched = expectedSignals.filter(signal => text.includes(signal)).length;
    const asksConfirmation = /explicit confirmation|ask for explicit confirmation|do not call/.test(expected);
    const safeAction = /confirm|authorization|authorized|do not|don't|should not|ask/.test(text);
    const quality = Math.min(1, 0.8 * (matched / Math.max(1, expectedSignals.length)) + 0.2 * (asksConfirmation && safeAction ? 1 : asksConfirmation ? 0 : 1));
    return { quality: Number(quality.toFixed(3)), passed: quality >= 0.65, mode: "reference_match", matchedSignals: matched, totalSignals: expectedSignals.length, reason: `Matched ${matched}/${expectedSignals.length} tool/action signals.` };
  }

  if (item.category === "rag") {
    const expectedTokens = [...tokenSet(expected)];
    const matched = expectedTokens.filter(token => text.includes(token)).length;
    const quality = matched / Math.max(1, expectedTokens.length);
    return { quality: Number(quality.toFixed(3)), passed: quality >= 0.7, mode: "semantic_overlap", matchedSignals: matched, totalSignals: expectedTokens.length, reason: `Matched ${matched}/${expectedTokens.length} grounded reference tokens.` };
  }

  if (item.category === "agent_planning" || item.category === "reliability" || item.category === "safety" || item.category === "regression") {
    const clauses = expected.split(/(?:;|,| and )/).map(value => value.trim()).filter(value => value.length >= 4).slice(0, 6);
    const matched = clauses.filter(clause => {
      const clauseTokens = clause.split(" ").filter(token => token.length > 3);
      const hitCount = clauseTokens.filter(token => text.includes(token)).length;
      return hitCount >= Math.max(1, Math.ceil(clauseTokens.length * 0.5));
    }).length;
    const negativeExpected = /no;|not;|reject|refuse|should not|do not|no,/i.test(expected);
    const safeHandling = negativeExpected && hasAny(text, ["no", "not", "refuse", "reject", "should not", "do not", "cannot"]);
    const quality = Math.min(1, matched / Math.max(1, clauses.length) + (safeHandling ? 0.15 : 0));
    return { quality: Number(Math.min(1, quality).toFixed(3)), passed: quality >= 0.6, mode: "semantic_overlap", matchedSignals: matched + (safeHandling ? 1 : 0), totalSignals: clauses.length + (safeHandling ? 1 : 0), reason: `Matched ${matched}/${clauses.length} expected policy/planning signals.` };
  }

  if (item.category === "text_to_sql") {
    const sql = text;
    const selectOnly = sql.includes("select") && !hasAny(sql, [" insert ", " update ", " delete ", " drop ", " alter ", " truncate "]);
    const expectedSignals = expected.split(/(?:,| and |\.)/).map(value => value.trim()).filter(Boolean).slice(0, 7);
    const matched = expectedSignals.filter(signal => tokenSet(signal).size === 0 || [...tokenSet(signal)].every(token => sql.includes(token))).length;
    const quality = Math.min(1, 0.65 * (matched / Math.max(1, expectedSignals.length)) + 0.35 * (selectOnly ? 1 : 0));
    return { quality: Number(quality.toFixed(3)), passed: quality >= 0.7, mode: "structural", matchedSignals: matched, totalSignals: expectedSignals.length, reason: `SQL constraints matched ${matched}/${expectedSignals.length}; read-only=${selectOnly}.` };
  }

  if (item.category === "code_generation") {
    const expectedTokens = [...tokenSet(expected)].filter(token => !["use", "with", "and", "the", "return"].includes(token));
    const matched = expectedTokens.filter(token => text.includes(token)).length;
    const quality = matched / Math.max(1, expectedTokens.length);
    return { quality: Number(quality.toFixed(3)), passed: quality >= 0.55, mode: "semantic_overlap", matchedSignals: matched, totalSignals: expectedTokens.length, reason: `Matched ${matched}/${expectedTokens.length} implementation signals.` };
  }

  const expectedTokens = [...tokenSet(expected)];
  const matched = expectedTokens.filter(token => text.includes(token)).length;
  const quality = matched / Math.max(1, expectedTokens.length);
  return { quality: Number(quality.toFixed(3)), passed: quality >= 0.6, mode: "semantic_overlap", matchedSignals: matched, totalSignals: expectedTokens.length, reason: `Matched ${matched}/${expectedTokens.length} expected signals.` };
}

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

function promptFor(item: BenchmarkCase) {
  return [
    { role: "system" as const, content: "You are being evaluated on a fixed production benchmark. Follow the task exactly. Be concise and do not invent facts." },
    { role: "user" as const, content: item.task },
  ];
}

export async function POST() {
  try {
    const cases = benchmarkCases as BenchmarkCase[];
    if (cases.length !== 50) return NextResponse.json({ error: "Benchmark suite must contain exactly 50 cases." }, { status: 500 });

    // Preflight prevents an entire benchmark from becoming 0% when the problem is provider reachability.
    const smoke = await runProviderCascade(promptFor(cases[0]), 120, {
      attemptTimeoutMs: BENCHMARK_ATTEMPT_TIMEOUT_MS,
      totalDeadlineMs: BENCHMARK_CASE_DEADLINE_MS,
      maxModelsPerProvider: BENCHMARK_MAX_MODELS_PER_PROVIDER,
    });
    if (!smoke.result) {
      return NextResponse.json({
        error: "Provider preflight failed. No configured model produced a response, so the benchmark was not run.",
        smoke: { attempts: smoke.attempts },
      }, { status: 503 });
    }

    const started = performance.now();
    const results = await mapWithConcurrency(cases, BENCHMARK_CONCURRENCY, async item => {
      const cascade = await runProviderCascade(promptFor(item), 120, {
        attemptTimeoutMs: BENCHMARK_ATTEMPT_TIMEOUT_MS,
        totalDeadlineMs: BENCHMARK_CASE_DEADLINE_MS,
        maxModelsPerProvider: BENCHMARK_MAX_MODELS_PER_PROVIDER,
      });

      if (!cascade.result) {
        return { id: item.id, category: item.category, status: "infra_failed" as const, quality: 0, latencyMs: null, provider: null, model: null, fallbacks: cascade.attempts.length, attempts: cascade.attempts } satisfies BenchmarkResult;
      }

      const evaluation = scoreByCategory(item, cascade.result.output);
      return {
        id: item.id,
        category: item.category,
        status: evaluation.passed ? "passed" : "failed",
        quality: evaluation.quality,
        latencyMs: cascade.result.latencyMs,
        provider: cascade.result.provider,
        model: cascade.result.model,
        fallbacks: cascade.attempts.filter((attempt: AttemptResult) => attempt.outcome !== "success").length,
        attempts: cascade.attempts,
        output: cascade.result.output,
        evaluation,
      } satisfies BenchmarkResult;
    });

    let persisted = 0;
    if (databaseConfigured()) {
      try {
        const data = results.map(result => ({
          externalId: `bench_${Date.now()}_${result.id}`,
          task: result.id,
          status: result.status === "passed" ? "passed" : "failed",
          selectedModel: result.model ?? "unresolved",
          reason: `50-case benchmark · ${result.category}`,
          quality: result.quality,
          latencyMs: result.latencyMs ?? 0,
          cost: 0,
          reliability: result.status === "passed" ? 1 : 0,
          candidatesJson: result.attempts,
          traceJson: [{ step: "Benchmark case", status: result.status, detail: result.id }, { step: "Provider cascade", status: result.status, detail: result.model ? `${result.provider} / ${result.model}` : "No candidate succeeded" }],
        }));
        persisted = (await db.evaluationRun.createMany({ data })).count;
      } catch (error) {
        console.error("Benchmark persistence failed", error);
      }
    }

    const passed = results.filter(result => result.status === "passed");
    const evaluatedFailures = results.filter(result => result.status === "failed");
    const infraFailures = results.filter(result => result.status === "infra_failed");
    const providerMix = Object.fromEntries([...new Set(results.map(result => result.provider).filter(Boolean))].map(provider => [provider, results.filter(result => result.provider === provider).length]));

    return NextResponse.json({
      suite: { name: "routing-bench-v1", cases: 50 },
      durationMs: Math.round(performance.now() - started),
      summary: {
        passed: passed.length,
        failed: evaluatedFailures.length,
        infraFailed: infraFailures.length,
        averageQuality: Number((average(results.filter(result => result.status !== "infra_failed").map(result => result.quality)) ?? 0).toFixed(3)),
        passedQuality: Number((average(passed.map(result => result.quality)) ?? 0).toFixed(3)),
        p95LatencyMs: p95(passed.map(result => result.latencyMs ?? 0)),
        fallbackRate: Number((rate(results.filter(result => result.fallbacks > 0).length, results.length) ?? 0).toFixed(3)),
        persisted,
      },
      providerMix,
      byCategory: Object.fromEntries(
        [...new Set(results.map(result => result.category))].map(category => {
          const categoryResults = results.filter(result => result.category === category);
          const evaluated = categoryResults.filter(result => result.status !== "infra_failed");
          return [category, {
            cases: categoryResults.length,
            passed: categoryResults.filter(result => result.status === "passed").length,
            infraFailed: categoryResults.filter(result => result.status === "infra_failed").length,
            quality: Number((average(evaluated.map(result => result.quality)) ?? 0).toFixed(3)),
          }];
        }),
      ),
      failures: [...evaluatedFailures, ...infraFailures].slice(0, 10).map(result => ({ id: result.id, category: result.category, status: result.status, attempts: result.attempts })),
    });
  } catch (error) {
    console.error("Benchmark run failed", error);
    return NextResponse.json({ error: "Benchmark could not be completed." }, { status: 503 });
  }
}
