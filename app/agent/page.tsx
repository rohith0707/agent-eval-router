"use client";

import { useState } from "react";

type Decision = { action?: string; policy_action?: string; reason_code?: string; reason?: string; risk?: string; provider?: string; model?: string; evidence_count?: number; estimated_cost_usd?: number; };
type Result = { run_id?: string; status?: string; loop_action?: string; iteration?: number; provider?: string; model?: string; quality?: number; latency_ms?: number; cost_usd?: number; total_cost_usd?: number; output?: string; decision_id?: string; decision?: Decision; verification?: { passed?: boolean; quality?: number; checks?: string[]; provenance?: string }; trajectory?: { step: string; status: string; detail?: string; iteration?: number }[]; limits?: Record<string, number> };

const demoTask = "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";

export default function AgentControlPlane() {
  const [task, setTask] = useState(demoTask);
  const [maxCost, setMaxCost] = useState(0.05);
  const [maxIterations, setMaxIterations] = useState(3);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, task_type: "coding", constraints: { quality_floor: 0.7, max_cost_usd: maxCost, max_iterations: maxIterations } }) });
      if (!res.ok) throw new Error(`Agent backend returned ${res.status}`);
      setResult(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reach agent backend."); }
    finally { setRunning(false); }
  }

  return <div className="content">
    <header className="header"><div><div className="crumb">Agent Eval Router / Control Plane</div><h1 className="h1">Autonomous Work Control Plane</h1><p className="sectionSub">Agents can act autonomously. The control plane decides whether they should, verifies the result, and stops runaway work.</p></div></header>

    <section className="card" style={{ marginBottom: 18 }}>
      <h2 className="sectionTitle">Run a controlled task</h2>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <textarea className="textArea" rows={4} value={task} onChange={e => setTask(e.target.value)} style={{ width: "100%", padding: 12, fontSize: 14, border: "1px solid var(--border)", borderRadius: 6 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label><div className="signalTitle">Hard cost limit ($)</div><input type="number" min="0" step="0.01" value={maxCost} onChange={e => setMaxCost(Number(e.target.value))} style={{ width: "100%", padding: 8 }} /></label>
          <label><div className="signalTitle">Max repair loops</div><input type="number" min="1" max="10" value={maxIterations} onChange={e => setMaxIterations(Number(e.target.value))} style={{ width: "100%", padding: 8 }} /></label>
        </div>
        <button className="button" onClick={run} disabled={running || !task.trim()}>{running ? "Running controlled loop…" : "Run control plane"}</button>
      </div>
    </section>

    {error && <section className="card" style={{ borderLeft: "3px solid #ef4444", marginBottom: 18 }}><p>{error}</p></section>}

    {result && <>
      <section className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div><h2 className="sectionTitle">Decision timeline</h2><p className="sectionSub">Run {result.run_id ?? "—"} · Decision {result.decision_id ?? "—"}</p></div><strong>{result.loop_action ?? result.status}</strong></div>
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>{(result.trajectory ?? []).map((t, i) => <div key={`${t.step}-${i}`} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 6, display: "grid", gridTemplateColumns: "90px 90px 1fr", gap: 10 }}><strong>{t.step}</strong><span>{t.status}</span><span className="sectionSub">{t.detail}</span></div>)}</div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="sectionTitle">Why did the system do this?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          <div className="signal"><div className="signalTitle">Decision</div><div className="signalValue">{result.decision?.policy_action ?? result.decision?.action ?? "—"}</div></div>
          <div className="signal"><div className="signalTitle">Risk</div><div className="signalValue">{result.decision?.risk ?? "—"}</div></div>
          <div className="signal"><div className="signalTitle">Evidence</div><div className="signalValue">{result.decision?.evidence_count ?? 0}</div></div>
          <div className="signal"><div className="signalTitle">Estimated cost</div><div className="signalValue">${(result.decision?.estimated_cost_usd ?? 0).toFixed(4)}</div></div>
        </div>
        <p className="sectionSub" style={{ marginTop: 12 }}><strong>{result.decision?.reason_code ?? "—"}</strong> — {result.decision?.reason ?? "No explanation returned."}</p>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="sectionTitle">Verification</h2><p className="sectionSub">{result.verification?.provenance ?? "—"}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 12 }}>
          <div className="signal"><div className="signalTitle">Status</div><div className="signalValue">{result.status}</div></div>
          <div className="signal"><div className="signalTitle">Loop</div><div className="signalValue">{result.loop_action}</div></div>
          <div className="signal"><div className="signalTitle">Iteration</div><div className="signalValue">{result.iteration}</div></div>
          <div className="signal"><div className="signalTitle">Quality</div><div className="signalValue">{result.quality?.toFixed(3) ?? "—"}</div></div>
          <div className="signal"><div className="signalTitle">Cost</div><div className="signalValue">${(result.total_cost_usd ?? result.cost_usd ?? 0).toFixed(4)}</div></div>
        </div>
        <p className="sectionSub" style={{ marginTop: 12 }}>Checks: {(result.verification?.checks ?? []).join(", ") || "none"}</p>
      </section>

      {result.output && <section className="card"><h2 className="sectionTitle">Verified output</h2><pre style={{ background: "var(--bg-muted)", padding: 16, borderRadius: 6, whiteSpace: "pre-wrap" }}>{result.output}</pre></section>}
    </>}
  </div>;
}
