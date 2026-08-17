"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DashboardShell from "./components/DashboardShell";

type Run = {
  externalId: string;
  selectedModel: string;
  quality: number;
  latencyMs: number;
  status: string;
};

type RunsResponse = {
  runs?: Run[];
  summary?: {
    count: number;
    avgQuality: number | null;
    p95LatencyMs: number | null;
    passRate: number | null;
  };
  warning?: string;
};

export default function Home() {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/runs", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: RunsResponse) => {
        if (!active) return;
        setData(payload);
        setError(payload.warning ?? "");
      })
      .catch(() => {
        if (active) setError("Unable to load evaluation evidence right now.");
      });

    return () => {
      active = false;
    };
  }, []);

  const runs = data?.runs ?? [];
  const summary = data?.summary;
  const values = useMemo(
    () => runs.slice(0, 12).reverse().map((run) => Math.max(16, Math.round(run.quality * 190))),
    [runs],
  );

  return (
    <DashboardShell
      title="Dashboard"
      eyebrow="Control Plane"
      action={
        <Link href="/live" className="button">
          Run evaluation
        </Link>
      }
    >
      {error && <div className="notice">{error}</div>}

      <section className="heroCard">
        <div>
          <p className="eyebrow">Production AI reliability</p>
          <h2 className="heroTitle">Evaluate models, route by evidence, recover from failures.</h2>
          <p className="heroDesc">
            A model-agnostic control plane for quality, latency, reliability and cost. The benchmark suite is fixed;
            production results are persisted and inspectable.
          </p>
        </div>
        <div className="heroActions">
          <Link href="/live" className="button">Live evaluation</Link>
          <Link href="/benchmarks" className="button secondary">50-case benchmark</Link>
        </div>
      </section>

      <section className="grid4">
        <Metric label="Average quality" value={summary?.avgQuality == null ? "—" : `${(summary.avgQuality * 100).toFixed(1)}%`} sub="Observed persisted evidence" />
        <Metric label="p95 latency" value={summary?.p95LatencyMs == null ? "—" : `${summary.p95LatencyMs}ms`} sub="Completed runs" />
        <Metric label="Evaluations" value={summary?.count ?? 0} sub="Stored runs" />
        <Metric label="Pass rate" value={summary?.passRate == null ? "—" : `${(summary.passRate * 100).toFixed(1)}%`} sub="Observed status" />
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Benchmark readiness</h2>
              <p className="sectionSub">Fixed suite used for regression and routing comparisons.</p>
            </div>
            <Link href="/benchmarks" className="textLink">Open →</Link>
          </div>
          <div className="signalGrid">
            <Signal title="Cases" value="50" />
            <Signal title="Categories" value="10" />
            <Signal title="Baselines" value="3" />
            <Signal title="Evaluation" value="Evidence-first" />
          </div>
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Routing policy</h2>
              <p className="sectionSub">Online serving uses bounded fallback; offline benchmark runs compare candidates.</p>
            </div>
            <Link href="/models/performance" className="textLink">Models →</Link>
          </div>
          <div className="listBlock">
            <div className="listRow">
              <div className="listTitle">Primary objective</div>
              <div className="sectionSub">Maximize quality subject to latency, cost and reliability constraints.</div>
            </div>
            <div className="listRow">
              <div className="listTitle">Provider order</div>
              <div className="sectionSub">Gemini → Hugging Face → NVIDIA → OpenRouter.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Quality trend</h2>
              <p className="sectionSub">Latest persisted evaluation runs</p>
            </div>
            <Link href="/runs" className="textLink">Runs →</Link>
          </div>
          {values.length ? (
            <>
              <div className="trend">
                {values.map((value, index) => (
                  <div key={index} className="bar" style={{ height: `${value}px` }} />
                ))}
              </div>
              <div className="axis"><span>Older</span><span>Recent</span></div>
            </>
          ) : (
            <div className="empty">No evaluation evidence yet.</div>
          )}
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Recent evidence</h2>
              <p className="sectionSub">No fabricated benchmark numbers.</p>
            </div>
            <Link href="/runs" className="textLink">All runs →</Link>
          </div>
          {runs.length ? (
            <table className="table">
              <thead>
                <tr><th>Run</th><th>Model</th><th>Quality</th><th>Latency</th><th>Status</th></tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map((run) => (
                  <tr key={run.externalId}>
                    <td>{run.externalId}</td>
                    <td>{run.selectedModel}</td>
                    <td>{(run.quality * 100).toFixed(1)}%</td>
                    <td>{run.latencyMs ? `${run.latencyMs}ms` : "—"}</td>
                    <td><span className="pill">{run.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Run the benchmark or live evaluation to create evidence.</div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="card">
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
      <div className="metricDelta">{sub}</div>
    </div>
  );
}

function Signal({ title, value }: { title: string; value: string }) {
  return (
    <div className="signal">
      <div className="signalTitle">{title}</div>
      <div className="signalValue">{value}</div>
    </div>
  );
}
