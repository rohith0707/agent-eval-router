"use client";
import DashboardShell from "@/app/components/DashboardShell";
import { useState } from "react";

type BenchmarkResult = {
  summary: {
    passed: number;
    failed: number;
    infraFailed: number;
    averageQuality: number;
    p95LatencyMs: number | null;
    fallbackRate: number;
    persisted: number;
  };
  durationMs: number;
  byCategory: Record<string, { cases: number; passed: number; infraFailed: number; quality: number }>;
  failures?: Array<{ id: string; category: string; status: string; attempts: Array<{ provider: string; model: string; outcome: string; latencyMs: number }> }>;
};

const categories = [
  ["Reasoning", 5], ["Structured output", 5], ["Tool calling", 5], ["RAG", 5], ["Agent planning", 5],
  ["Reliability", 5], ["Text-to-SQL", 5], ["Safety / injection", 5], ["Code generation", 5], ["Regression", 5],
] as const;

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
        const detail = body.smoke?.attempts?.map((attempt: { provider: string; model: string; outcome: string }) => `${attempt.provider}/${attempt.model}: ${attempt.outcome}`).join(" · ");
        throw new Error(detail ? `${body.error} ${detail}` : body.error || "Benchmark failed");
      }
      setResult(body as BenchmarkResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Benchmark failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <DashboardShell title="50-Case Benchmark" eyebrow="Evaluation" action={<button onClick={run} disabled={running} className="button">{running ? "Running 50 cases…" : "Run 50 cases"}</button>}>
      {error && <div className="notice">{error}</div>}
      <div className="pageIntro"><div><div className="eyebrow">Fixed regression suite</div><h2 className="pageTitle">One benchmark. Fifty production-style cases.</h2><p className="pageDesc">The same cases compare routing across quality, reliability, latency and safety. Provider failures are reported separately from model-quality failures.</p></div></div>

      <section className="grid4">
        <Metric label="Cases" value="50" sub="Project-owned test cases" />
        <Metric label="Categories" value="10" sub="5 cases each" />
        <Metric label="Baselines" value="3" sub="Single / cheapest / fastest" />
        <Metric label="Latest status" value={result ? "Completed" : "Not run"} sub={result ? `${result.summary.passed}/50 passed` : "No fabricated results"} />
      </section>

      {result && <section className="grid4" style={{ marginTop: 14 }}>
        <Metric label="Average quality" value={`${(result.summary.averageQuality * 100).toFixed(1)}%`} sub="Evaluated responses only" />
        <Metric label="p95 latency" value={result.summary.p95LatencyMs ? `${result.summary.p95LatencyMs}ms` : "—"} sub="Successful routed cases" />
        <Metric label="Fallback rate" value={`${(result.summary.fallbackRate * 100).toFixed(1)}%`} sub="Cases needing recovery" />
        <Metric label="Infrastructure failures" value={`${result.summary.infraFailed}`} sub="No usable provider response" />
      </section>}

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card"><h2 className="sectionTitle">What this benchmark answers</h2><div className="listBlock"><Row title="Quality" text="Does the selected model solve the task correctly?" /><Row title="Reliability" text="Does the router recover when the preferred model fails?" /><Row title="Latency" text="Can the system meet a bounded response budget?" /><Row title="Routing" text="Does adaptive routing beat simple fixed-model baselines?" /></div></div>
        <div className="card"><h2 className="sectionTitle">Coverage</h2><div className="coverage">{categories.map(([name, count]) => <div className="coverageRow" key={name}><span>{name}</span><span className="pill">{count} cases</span></div>)}</div></div>
      </section>

      {result && <section className="card" style={{ marginTop: 18 }}>
        <div className="topRow"><div><h2 className="sectionTitle">Category results</h2><p className="sectionSub">Real run output from the current model cascade.</p></div><span className="pill">{result.durationMs}ms total</span></div>
        <table className="table"><thead><tr><th>Category</th><th>Cases</th><th>Passed</th><th>Infra failed</th><th>Quality</th></tr></thead><tbody>{Object.entries(result.byCategory).map(([key, value]) => <tr key={key}><td>{key}</td><td>{value.cases}</td><td>{value.passed}</td><td>{value.infraFailed}</td><td>{value.infraFailed === value.cases ? "—" : `${(value.quality * 100).toFixed(1)}%`}</td></tr>)}</tbody></table>
      </section>}

      {result?.failures?.length ? <section className="card" style={{ marginTop: 18 }}><h2 className="sectionTitle">Failure diagnostics</h2><p className="sectionSub">Provider failures are shown as operational evidence, not scored as model quality.</p><div className="listBlock">{result.failures.slice(0, 10).map(failure => <div className="listRow" key={failure.id}><div className="listTitle">{failure.id} · {failure.category}</div><div className="sectionSub">{failure.attempts.map(attempt => `${attempt.provider}/${attempt.model}: ${attempt.outcome} (${attempt.latencyMs}ms)`).join(" · ")}</div></div>)}</div></section> : null}

      <section className="card" style={{ marginTop: 18 }}><h2 className="sectionTitle">Benchmark policy</h2><p className="sectionSub">The suite stays fixed so routing/model changes are comparable. External gated benchmarks remain separate and are never copied into the repository.</p><div className="policyGrid"><div><b>Baseline</b><span>Single-model routing</span></div><div><b>Baseline</b><span>Cheapest model</span></div><div><b>Baseline</b><span>Fastest model</span></div><div><b>Objective</b><span>Quality under latency, cost and reliability constraints</span></div></div></section>
    </DashboardShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricDelta">{sub}</div></div>;
}

function Row({ title, text }: { title: string; text: string }) {
  return <div className="listRow"><div className="listTitle">{title}</div><div className="sectionSub">{text}</div></div>;
}
