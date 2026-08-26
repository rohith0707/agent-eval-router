"use client";

import DashboardShell from "@/app/components/DashboardShell";
import { useMemo, useState } from "react";

type CategoryResult = {
  cases: number;
  evaluated?: number;
  passed: number;
  infraFailed: number;
  quality: number;
};

type BenchmarkResult = {
  summary: {
    passed: number;
    failed: number;
    infraFailed: number;
    evaluated?: number;
    averageQuality: number;
    passedQuality?: number;
    p95LatencyMs: number | null;
    fallbackRate: number;
    persisted: number;
  };
  durationMs: number;
  providerMix?: Record<string, number>;
  byCategory: Record<string, CategoryResult>;
  failures?: Array<{
    id: string;
    category: string;
    status: string;
    grader?: { version: string; mode: string; reason: string } | null;
    attempts: Array<{ provider: string; model: string; outcome: string; latencyMs: number }>;
  }>;
};

const categories = [
  ["Reasoning", 5],
  ["Structured output", 5],
  ["Tool calling", 5],
  ["RAG", 5],
  ["Agent planning", 5],
  ["Reliability", 5],
  ["Text-to-SQL", 5],
  ["Safety / injection", 5],
  ["Code generation", 5],
  ["Regression", 5],
] as const;

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Benchmarks() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/benchmark", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        const detail = body.smoke?.attempts
          ?.map((a: { provider: string; model: string; outcome: string }) => `${a.provider}/${a.model}: ${a.outcome}`)
          .join(" · ");
        throw new Error(detail ? `${body.error} ${detail}` : body.error || "Benchmark failed");
      }
      setResult(body as BenchmarkResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Benchmark failed");
    } finally {
      setRunning(false);
    }
  }

  const insights = useMemo(() => {
    if (!result) return null;

    const total = result.summary.passed + result.summary.failed + result.summary.infraFailed;
    const evaluated = Math.max(0, total - result.summary.infraFailed);
    const passRate = evaluated ? result.summary.passed / evaluated : 0;
    const reliabilityRate = total ? 1 - result.summary.infraFailed / total : 0;
    const failedByCategory = Object.entries(result.byCategory)
      .map(([category, value]) => ({ category, infra: value.infraFailed, evaluated: value.evaluated ?? Math.max(0, value.cases - value.infraFailed), passed: value.passed, quality: value.quality }))
      .sort((a, b) => b.infra - a.infra);
    const worstQuality = Object.entries(result.byCategory)
      .filter(([, value]) => (value.evaluated ?? value.cases - value.infraFailed) > 0)
      .sort((a, b) => a[1].quality - b[1].quality)[0];
    const bestCategory = Object.entries(result.byCategory)
      .filter(([, value]) => (value.evaluated ?? value.cases - value.infraFailed) > 0)
      .sort((a, b) => b[1].passed / Math.max(1, valueEvaluated(b[1])) - a[1].passed / Math.max(1, valueEvaluated(a[1])))[0];

    let recommendation = "Run the adaptive policy again after reviewing the failure mix.";
    let recommendationDetail = "The benchmark is producing decision evidence, but the next improvement should target the largest measurable gap.";

    if (result.summary.infraFailed > 0) {
      recommendation = `Investigate provider reliability before tuning model quality.`;
      recommendationDetail = `${result.summary.infraFailed}/${total} cases were not evaluable because the provider cascade did not return a usable response.`;
    } else if (worstQuality && worstQuality[1].quality < 0.7) {
      recommendation = `Prioritize ${formatCategory(worstQuality[0])} evaluation quality.`;
      recommendationDetail = `${formatCategory(worstQuality[0])} has the weakest evaluated quality signal at ${pct(worstQuality[1].quality)}.`;
    } else if (passRate < 0.8) {
      recommendation = "Improve task success before optimizing for cost.";
      recommendationDetail = `Only ${pct(passRate)} of evaluated cases pass the task-specific acceptance criteria.`;
    } else if (bestCategory) {
      recommendation = `Use ${formatCategory(bestCategory[0])} as the next routing pattern to study.`;
      recommendationDetail = `It currently has the strongest observed pass rate among categories with evaluated cases.`;
    }

    return {
      total,
      evaluated,
      passRate,
      reliabilityRate,
      failedByCategory,
      recommendation,
      recommendationDetail,
      costMeasured: false,
    };
  }, [result]);

  return (
    <DashboardShell
      title="Benchmark"
      eyebrow="AI Evaluation"
      action={
        <button onClick={run} disabled={running} className="button">
          {running ? "Running 50 cases…" : "Run 50 cases"}
        </button>
      }
    >
      {error && <div className="notice">{error}</div>}

      <section className="pageIntro">
        <div>
          <div className="eyebrow">Decision evidence</div>
          <h2 className="pageTitle">Does the AI system actually work better?</h2>
          <p className="pageDesc">
            Evaluate the same 50 product-style tasks, separate model quality from infrastructure failures, and turn the results into the next engineering decision.
          </p>
        </div>
      </section>

      {!result && (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="topRow">
            <div>
              <div className="eyebrow">Ready to evaluate</div>
              <h2 className="sectionTitle" style={{ marginBottom: 6 }}>One fixed suite. Ten task families.</h2>
              <p className="sectionSub">No benchmark numbers are fabricated before a real run completes.</p>
            </div>
            <span className="pill">50 cases · 10 categories</span>
          </div>
          <div className="grid4" style={{ marginTop: 16 }}>
            <Metric label="Coverage" value="50" sub="Production-style cases" />
            <Metric label="Task families" value="10" sub="Reasoning to regression" />
            <Metric label="Evaluation" value="Task-specific" sub="Category-aware grading" />
            <Metric label="Evidence" value="Traceable" sub="Attempts + grader reason" />
          </div>
        </section>
      )}

      {result && insights && (
        <>
          <section className="grid4" style={{ marginTop: 18 }}>
            <Metric label="Task success" value={pct(insights.passRate)} sub="Passed / evaluated" />
            <Metric label="Quality" value={pct(result.summary.averageQuality)} sub="Evaluated responses only" />
            <Metric label="Reliability" value={pct(insights.reliabilityRate)} sub="Responses available" />
            <Metric label="p95 latency" value={result.summary.p95LatencyMs ? `${result.summary.p95LatencyMs}ms` : "—"} sub="Passed-case latency" />
          </section>

          <section className="grid4" style={{ marginTop: 14 }}>
            <Metric label="Evaluated" value={`${insights.evaluated}/${insights.total}`} sub="Usable model responses" />
            <Metric label="Fallback rate" value={pct(result.summary.fallbackRate)} sub="Requests needing recovery" />
            <Metric label="Infra failures" value={`${result.summary.infraFailed}`} sub="Excluded from quality scoring" />
            <Metric label="Cost telemetry" value="Not measured" sub="No fabricated cost deltas" />
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="topRow">
              <div>
                <div className="eyebrow">Executive readout</div>
                <h2 className="sectionTitle" style={{ marginBottom: 6 }}>{insights.recommendation}</h2>
                <p className="sectionSub">{insights.recommendationDetail}</p>
              </div>
              <span className="pill">Grader {result.summary.passedQuality != null ? "v2.x" : "active"}</span>
            </div>
          </section>

          <section className="grid2" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="eyebrow">Failure concentration</div>
              <h2 className="sectionTitle" style={{ marginBottom: 6 }}>Where is the system breaking?</h2>
              <p className="sectionSub">Infrastructure failures are shown separately from task-quality failures.</p>
              <div className="listBlock" style={{ marginTop: 12 }}>
                {insights.failedByCategory.slice(0, 5).map((item) => (
                  <div className="listRow" key={item.category}>
                    <div className="topRow">
                      <div className="listTitle">{formatCategory(item.category)}</div>
                      <span className="pill">{item.infra} infra</span>
                    </div>
                    <div className="sectionSub">{item.passed}/{item.evaluated} evaluated cases passed · quality {pct(item.quality)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="eyebrow">Decision comparison</div>
              <h2 className="sectionTitle" style={{ marginBottom: 6 }}>What we know — and what we still need to prove</h2>
              <div className="policyGrid" style={{ marginTop: 14 }}>
                <div><b>Current run</b><span>{pct(insights.passRate)} task success</span></div>
                <div><b>Reliability</b><span>{pct(insights.reliabilityRate)} available responses</span></div>
                <div><b>Baseline delta</b><span>Not measured yet</span></div>
                <div><b>Cost delta</b><span>Not measured yet</span></div>
              </div>
              <p className="sectionSub" style={{ marginTop: 14 }}>
                The next experiment should run fixed-model, cheapest-viable, and adaptive strategies on the same cases. Until those runs are persisted, this dashboard intentionally shows no invented improvement percentage.
              </p>
            </div>
          </section>
        </>
      )}

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="sectionTitle">What this benchmark answers</h2>
          <div className="listBlock">
            <Row title="Task success" text="Does the selected AI strategy satisfy the product acceptance criteria?" />
            <Row title="Reliability" text="Does the system recover when the preferred provider or model fails?" />
            <Row title="Latency" text="Can the strategy stay inside a bounded response budget?" />
            <Row title="Evaluation" text="Can we explain why a response passed or failed?" />
          </div>
        </div>
        <div className="card">
          <h2 className="sectionTitle">Coverage</h2>
          <p className="sectionSub">The same fixed suite makes regressions comparable over time.</p>
          <div className="coverage" style={{ marginTop: 12 }}>
            {categories.map(([name, count]) => (
              <div className="coverageRow" key={name}>
                <span>{name}</span><span className="pill">{count} cases</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {result && (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="topRow">
            <div>
              <div className="eyebrow">Drill-down</div>
              <h2 className="sectionTitle">Category performance</h2>
              <p className="sectionSub">Use this table to diagnose the executive summary above. Pass rate is primary; quality is secondary.</p>
            </div>
            <span className="pill">{result.durationMs}ms total</span>
          </div>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>Category</th><th>Cases</th><th>Evaluated</th><th>Passed</th><th>Pass rate</th><th>Infra</th><th>Quality</th></tr></thead>
              <tbody>
                {Object.entries(result.byCategory).map(([key, value]) => {
                  const evaluated = value.evaluated ?? Math.max(0, value.cases - value.infraFailed);
                  const passRate = evaluated ? value.passed / evaluated : 0;
                  return (
                    <tr key={key}>
                      <td>{formatCategory(key)}</td>
                      <td>{value.cases}</td>
                      <td>{evaluated}</td>
                      <td>{value.passed}</td>
                      <td><strong>{evaluated ? pct(passRate) : "—"}</strong></td>
                      <td>{value.infraFailed || "—"}</td>
                      <td>{evaluated ? pct(value.quality) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result?.failures?.length ? (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="eyebrow">Deep diagnostic</div>
          <h2 className="sectionTitle">Failure evidence</h2>
          <p className="sectionSub">Open these records when you need to explain the failure, provider behavior, and grader decision.</p>
          <div className="listBlock" style={{ marginTop: 12 }}>
            {result.failures.slice(0, 10).map((failure) => (
              <div className="listRow" key={failure.id}>
                <div className="listTitle">{failure.id} · {formatCategory(failure.category)}</div>
                <div className="sectionSub">{failure.attempts.map((attempt) => `${attempt.provider}/${attempt.model}: ${attempt.outcome} (${attempt.latencyMs}ms)`).join(" · ")}</div>
                {failure.grader && <div className="sectionSub" style={{ marginTop: 4 }}>{failure.grader.version} · {failure.grader.mode} · {failure.grader.reason}</div>}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">Benchmark policy</div>
        <h2 className="sectionTitle">What this run does not claim</h2>
        <div className="policyGrid" style={{ marginTop: 12 }}>
          <div><b>External score</b><span>None copied into the product</span></div>
          <div><b>Cost savings</b><span>Not reported until measured</span></div>
          <div><b>Baseline improvement</b><span>Requires a persisted baseline run</span></div>
          <div><b>Quality</b><span>Only evaluated responses contribute</span></div>
        </div>
      </section>
    </DashboardShell>
  );
}

function valueEvaluated(value: CategoryResult): number {
  return value.evaluated ?? Math.max(0, value.cases - value.infraFailed);
}

function formatCategory(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricDelta">{sub}</div></div>;
}

function Row({ title, text }: { title: string; text: string }) {
  return <div className="listRow"><div className="listTitle">{title}</div><div className="sectionSub">{text}</div></div>;
}
