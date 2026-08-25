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
      title="AI Workspace"
      eyebrow="AI Engineer"
      action={<Link href="/live" className="button">Open Product AI Lab</Link>}
    >
      {error && <div className="notice">{error}</div>}

      <section className="heroCard">
        <div>
          <p className="eyebrow">BUILD · EVALUATE · IMPROVE</p>
          <h2 className="heroTitle">Ship AI workflows that get better when the data says they should.</h2>
          <p className="heroDesc">
            Test realistic product tasks, compare AI strategies, inspect failures, and keep a reproducible record of what changed and why.
          </p>
        </div>
        <div className="heroActions">
          <Link href="/live" className="button">Try a product task</Link>
          <Link href="/benchmarks" className="button secondary">Run 50-case evaluation</Link>
        </div>
      </section>

      <section className="grid4">
        <Metric label="Task success" value={summary?.passRate == null ? "—" : `${(summary.passRate * 100).toFixed(1)}%`} sub="Observed persisted runs" />
        <Metric label="Quality" value={summary?.avgQuality == null ? "—" : `${(summary.avgQuality * 100).toFixed(1)}%`} sub="Evaluated responses" />
        <Metric label="p95 latency" value={summary?.p95LatencyMs == null ? "—" : `${summary.p95LatencyMs}ms`} sub="Completed runs" />
        <Metric label="Evaluations" value={summary?.count ?? 0} sub="Stored evidence runs" />
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">The AI-engineering loop</h2>
              <p className="sectionSub">The product is the improvement loop, not the model list.</p>
            </div>
            <Link href="/live" className="textLink">Try it →</Link>
          </div>
          <div className="listBlock">
            <div className="listRow"><div className="listTitle">1 · Understand the task</div><div className="sectionSub">Identify the quality bar, tools, latency target, and risk.</div></div>
            <div className="listRow"><div className="listTitle">2 · Execute an AI strategy</div><div className="sectionSub">Use the least expensive viable model, or escalate when the task demands deeper reasoning.</div></div>
            <div className="listRow"><div className="listTitle">3 · Evaluate the outcome</div><div className="sectionSub">Score task-specific correctness, grounding, structure, safety, and reliability.</div></div>
            <div className="listRow"><div className="listTitle">4 · Learn from failure</div><div className="sectionSub">Turn repeat failures into regression cases and improve the next version.</div></div>
          </div>
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Product tasks</h2>
              <p className="sectionSub">The same evaluation system can test different AI capabilities.</p>
            </div>
            <Link href="/live" className="textLink">Explore →</Link>
          </div>
          <div className="signalGrid">
            <Signal title="Investigation" value="Root-cause + evidence" />
            <Signal title="RAG" value="Grounded answers" />
            <Signal title="SQL" value="Safe, structured queries" />
            <Signal title="Agents" value="Tools + planning" />
          </div>
        </div>
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Quality trend</h2>
              <p className="sectionSub">Latest persisted AI evaluations</p>
            </div>
            <Link href="/runs" className="textLink">Runs →</Link>
          </div>
          {values.length ? (
            <>
              <div className="trend">
                {values.map((value, index) => <div key={index} className="bar" style={{ height: `${value}px` }} />)}
              </div>
              <div className="axis"><span>Older</span><span>Recent</span></div>
            </>
          ) : <div className="empty">Run the Product AI Lab to create evidence.</div>}
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Recent evidence</h2>
              <p className="sectionSub">Every result is traceable to a real run.</p>
            </div>
            <Link href="/runs" className="textLink">All runs →</Link>
          </div>
          {runs.length ? (
            <table className="table">
              <thead><tr><th>Run</th><th>Strategy</th><th>Quality</th><th>Latency</th><th>Status</th></tr></thead>
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
          ) : <div className="empty">No evaluation evidence yet.</div>}
        </div>
      </section>
    </DashboardShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricDelta">{sub}</div></div>;
}

function Signal({ title, value }: { title: string; value: string }) {
  return <div className="signal"><div className="signalTitle">{title}</div><div className="signalValue">{value}</div></div>;
}
