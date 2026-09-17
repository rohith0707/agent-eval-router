"use client";

import { useState } from "react";

type Agent = { role: string; status: string; detail?: string };
type Result = {
  provenance?: string; run_id?: string; status?: string; loop_action?: string; iteration?: number; output?: string;
  agents?: Agent[]; trajectory?: { step: string; status: string; detail?: string; iteration?: number }[];
  decision?: { action?: string; policy_action?: string; reason_code?: string; reason?: string; risk?: string; evidence_count?: number; estimated_cost_usd?: number; };
  verification?: { passed?: boolean; quality?: number; checks?: string[]; provenance?: string };
  evidence?: { claim: string; evidence: string; status: string }[];
  total_cost_usd?: number; latency_ms?: number; limits?: Record<string, number>;
};

const demoTask = "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";

export default function AgentControlPlane() {
  const [task, setTask] = useState(demoTask);
  const [maxCost, setMaxCost] = useState(0.05);
  const [maxIterations, setMaxIterations] = useState(3);
  const [demo, setDemo] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true); setError(null); setResult(null);
    try {
      const endpoint = demo ? "/api/agent/demo" : "/api/agent";
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, task_type: "coding", constraints: { quality_floor: 0.7, max_cost_usd: maxCost, max_iterations: maxIterations } }) });
      if (!res.ok) throw new Error(`Agent backend returned ${res.status}`);
      setResult(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reach agent backend."); }
    finally { setRunning(false); }
  }

  const statusIcon = (status: string) => status === "passed" || status === "complete" ? "✓" : status === "failed" ? "×" : "●";

  return <div className="content">
    <header className="header"><div><div className="crumb">Loop Engineer / Autonomous Control Plane</div><h1 className="h1">Autonomous Multi-Agent Software Engineer</h1><p className="sectionSub">Agents can act autonomously. The control plane decides when they can act, verifies the result, and stops runaway work.</p></div><div style={{ marginTop: 10, display: "inline-flex", gap: 8, alignItems: "center" }}><span style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 999, fontSize: 11 }}>{demo ? "SIMULATED DEMO" : "LIVE RUNTIME"}</span><button className="button" onClick={() => setDemo(!demo)}>{demo ? "Use live runtime" : "Use demo"}</button></div></header>

    <section className="card" style={{ marginBottom: 18 }}>
      <h2 className="sectionTitle">1. Submit engineering task</h2>
      <textarea className="textArea" rows={3} value={task} onChange={e => setTask(e.target.value)} style={{ width: "100%", padding: 12, marginTop: 10, fontSize: 14, border: "1px solid var(--border)", borderRadius: 6 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <label><div className="signalTitle">Hard cost limit ($)</div><input type="number" min="0" step="0.01" value={maxCost} onChange={e => setMaxCost(Number(e.target.value))} style={{ width: "100%", padding: 8 }} /></label>
        <label><div className="signalTitle">Max loops</div><input type="number" min="1" max="10" value={maxIterations} onChange={e => setMaxIterations(Number(e.target.value))} style={{ width: "100%", padding: 8 }} /></label>
      </div>
      <button className="button" onClick={run} disabled={running || !task.trim()} style={{ marginTop: 12 }}>{running ? "Running bounded loop…" : "Run autonomous engineer →"}</button>
    </section>

    {error && <section className="card" style={{ borderLeft: "3px solid #ef4444", marginBottom: 18 }}><p>{error}</p></section>}

    {result && <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(280px, 1fr)", gap: 18 }}>
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2 className="sectionTitle">2. Execution loop</h2><p className="sectionSub">{result.run_id} · iteration {result.iteration}</p></div><strong>{result.loop_action ?? result.status}</strong></div>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>{(result.agents ?? []).map((a, i) => <div key={a.role} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 6, display: "grid", gridTemplateColumns: "24px 120px 1fr", gap: 10, alignItems: "center" }}><strong>{statusIcon(a.status)}</strong><strong>{a.role}</strong><span className="sectionSub">{a.detail}</span></div>)}</div>
          <div style={{ marginTop: 16 }}><div className="signalTitle">Closed-loop trajectory</div>{(result.trajectory ?? []).map((t, i) => <div key={`${t.step}-${i}`} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)" }}><strong>{t.step}</strong><span>{t.status}</span><span className="sectionSub">{t.detail}</span></div>)}</div>
        </section>

        <div style={{ display: "grid", gap: 18 }}>
          <section className="card"><h2 className="sectionTitle">3. Evidence</h2><p className="sectionSub">Agents make claims. Evidence determines whether claims become truth.</p>{(result.evidence ?? []).map((e, i) => <div key={i} style={{ marginTop: 10, padding: 10, border: "1px solid var(--border)", borderRadius: 6 }}><strong>{e.claim}</strong><div className="sectionSub" style={{ marginTop: 4 }}>{e.evidence}</div><span style={{ fontSize: 10 }}>{e.status.toUpperCase()}</span></div>)}</section>
          <section className="card"><h2 className="sectionTitle">4. Decision</h2><div className="signal"><div className="signalTitle">Action</div><div className="signalValue">{result.decision?.action ?? "—"}</div></div><div className="signal"><div className="signalTitle">Risk / Evidence</div><div className="signalValue">{result.decision?.risk ?? "—"} / {result.decision?.evidence_count ?? 0}</div></div><p className="sectionSub" style={{ marginTop: 10 }}><strong>{result.decision?.reason_code}</strong> — {result.decision?.reason}</p></section>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18 }}><h2 className="sectionTitle">Verification & runtime limits</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 12 }}><div className="signal"><div className="signalTitle">Verification</div><div className="signalValue">{result.verification?.passed ? "PASS" : "FAIL"}</div></div><div className="signal"><div className="signalTitle">Quality</div><div className="signalValue">{result.verification?.quality?.toFixed(3) ?? "—"}</div></div><div className="signal"><div className="signalTitle">Cost</div><div className="signalValue">${(result.total_cost_usd ?? 0).toFixed(4)}</div></div><div className="signal"><div className="signalTitle">Latency</div><div className="signalValue">{result.latency_ms ?? "—"} ms</div></div><div className="signal"><div className="signalTitle">Provenance</div><div className="signalValue" style={{ fontSize: 11 }}>{result.provenance}</div></div></div><p className="sectionSub" style={{ marginTop: 12 }}>Checks: {(result.verification?.checks ?? []).join(" · ")}</p></section>

      {result.output && <section className="card" style={{ marginTop: 18 }}><h2 className="sectionTitle">Final output</h2><pre style={{ background: "var(--bg-muted)", padding: 16, borderRadius: 6, whiteSpace: "pre-wrap" }}>{result.output}</pre></section>}
    </>}
  </div>;
}
