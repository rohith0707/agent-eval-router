"use client";

import { useState } from "react";

type ReplayResult = {
  provider: string;
  model: string;
  rationale: string;
  confidence_score: number;
  evidence_used: number;
  constraints: {
    quality_floor: number;
    max_latency_ms: number;
    max_cost_usd: number;
    reliability_floor: number;
  };
};

type ExperimentSummary = {
  strategy: string;
  taskSuccessRate: number | null;
  averageQuality: number | null;
  p95LatencyMs: number | null;
  costPerSuccessfulTaskUsd: number | null;
  availability: number | null;
};

export default function EvidencePage() {
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [experiment, setExperiment] = useState<ExperimentSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEvidence() {
    setLoading(true);
    setError(null);
    try {
      const [expRes, replayRes] = await Promise.allSettled([
        fetch("/api/experiment").then((r) => r.json()),
        fetch("/api/replay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "Compare routing strategies on benchmark suite",
            task_type: "reasoning",
            constraints: { quality_floor: 0.7, max_latency_ms: 5000, max_cost_usd: 0.01, reliability_floor: 0.8 },
          }),
        }).then((r) => r.json()),
      ]);

      if (expRes.status === "fulfilled" && expRes.value?.experiment?.summaries) {
        setExperiment(expRes.value.experiment.summaries);
      }
      if (replayRes.status === "fulfilled" && replayRes.value?.provider) {
        setReplay(replayRes.value);
      }
    } catch (err) {
      setError("Failed to load evidence data.");
    } finally {
      setLoading(false);
    }
  }

  function bar(value: number | null, max: number, color: string) {
    if (value == null) return <div className="barEmpty">—</div>;
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div className="barContainer">
        <div className="barFill" style={{ width: `${pct}%`, background: color }} />
        <span className="barLabel">{typeof value === "number" && value < 1 ? (value * 100).toFixed(1) + "%" : value.toFixed(1)}</span>
      </div>
    );
  }

  return (
    <div className="content">
      <header className="header">
        <div>
          <div className="crumb">Agent Eval Router / Evidence Comparison</div>
          <h1 className="h1">Evidence-Driven Routing</h1>
        </div>
        <button className="button" onClick={loadEvidence} disabled={loading}>
          {loading ? "Loading…" : "Load evidence"}
        </button>
      </header>

      {error && <div className="card" style={{ borderLeft: "3px solid #ef4444", marginBottom: 16 }}><p>{error}</p></div>}

      {replay && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 className="sectionTitle">Constraint-Aware Replay Result</h2>
          <div className="signalGrid" style={{ marginTop: 12 }}>
            <div className="signal"><div className="signalTitle">Provider</div><div className="signalValue">{replay.provider}</div></div>
            <div className="signal"><div className="signalTitle">Model</div><div className="signalValue">{replay.model}</div></div>
            <div className="signal"><div className="signalTitle">Confidence</div><div className="signalValue">{(replay.confidence_score * 100).toFixed(1)}%</div></div>
            <div className="signal"><div className="signalTitle">Evidence rows</div><div className="signalValue">{replay.evidence_used}</div></div>
          </div>
          <p className="sectionSub" style={{ marginTop: 10 }}>{replay.rationale}</p>
        </section>
      )}

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="sectionTitle">Strategy Comparison</h2>
        <p className="sectionSub">Baseline (fixed) vs Cheapest Viable vs Adaptive Routing</p>
        {experiment ? (
          <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 12px" }}>Strategy</th>
                <th style={{ padding: "8px 12px" }}>Task Success</th>
                <th style={{ padding: "8px 12px" }}>Avg Quality</th>
                <th style={{ padding: "8px 12px" }}>p95 Latency</th>
                <th style={{ padding: "8px 12px" }}>Cost/Task</th>
                <th style={{ padding: "8px 12px" }}>Availability</th>
              </tr>
            </thead>
            <tbody>
              {experiment.map((s) => (
                <tr key={s.strategy} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.strategy}</td>
                  <td style={{ padding: "8px 12px" }}>{bar(s.taskSuccessRate, 1, "#22c55e")}</td>
                  <td style={{ padding: "8px 12px" }}>{bar(s.averageQuality, 1, "#3b82f6")}</td>
                  <td style={{ padding: "8px 12px" }}>{s.p95LatencyMs != null ? `${s.p95LatencyMs}ms` : "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{s.costPerSuccessfulTaskUsd != null ? `$${s.costPerSuccessfulTaskUsd.toFixed(4)}` : "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{bar(s.availability, 1, "#a855f7")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty" style={{ marginTop: 12 }}>
            No experiment data yet. Click &quot;Load evidence&quot; or run a 50-case experiment first.
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="sectionTitle">Constraint Configuration</h2>
        <p className="sectionSub">Current routing constraints applied to evidence-driven decisions</p>
        <div className="signalGrid" style={{ marginTop: 12 }}>
          <div className="signal"><div className="signalTitle">Quality floor</div><div className="signalValue">≥ 0.70</div></div>
          <div className="signal"><div className="signalTitle">Max latency</div><div className="signalValue">≤ 5000ms</div></div>
          <div className="signal"><div className="signalTitle">Max cost/task</div><div className="signalValue">≤ $0.010</div></div>
          <div className="signal"><div className="signalTitle">Reliability floor</div><div className="signalValue">≥ 0.80</div></div>
        </div>
      </section>
    </div>
  );
}
