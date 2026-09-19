"use client";

import { useState } from "react";

type Agent = { role: string; status: string; detail?: string };
type Result = {
  task?: string; provenance?: string; run_id?: string; status?: string; loop_action?: string;
  iteration?: number; output?: string;
  agents?: Agent[]; trajectory?: { step: string; status: string; detail?: string; iteration?: number }[];
  decision?: { action?: string; policy_action?: string; reason_code?: string; reason?: string; risk?: string; evidence_count?: number };
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
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, task_type: "coding", constraints: { quality_floor: 0.7, max_cost_usd: maxCost, max_iterations: maxIterations } }) });
      if (!res.ok) throw new Error("Agent backend returned " + res.status);
      setResult(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reach agent backend."); }
    finally { setRunning(false); }
  }

  const verified = !!result?.verification?.passed;
  const statusIcon = (status: string) => status === "passed" || status === "complete" ? "✓" : status === "failed" ? "×" : "•";

  return <div className="content">
    <header className="header">
      <div>
        <div className="crumb">AGENT RUN STUDIO / CONTROL PLANE</div>
        <h1 className="h1">From task to verified decision in seconds.</h1>
        <p className="sectionSub" style={{ maxWidth: 720 }}>
          Submit an engineering task. The control plane plans, routes, executes, tests, repairs when needed,
          and only declares success when evidence passes the verification gates.
        </p>
      </div>
      <div style={{ marginTop: 10, display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 999, fontSize: 11 }}>
          {demo ? "SIMULATED DEMO" : "LIVE RUNTIME"}
        </span>
        <button className="button" onClick={() => setDemo(!demo)}>{demo ? "Use live runtime" : "Use demo"}</button>
      </div>
    </header>

    <section className="card" style={{ marginBottom: 18 }}>
      <div className="crumb">01 / INPUT</div>
      <h2 className="sectionTitle" style={{ marginTop: 6 }}>Give the agent a job</h2>
      <textarea className="textArea" rows={3} value={task} onChange={e => setTask(e.target.value)}
        style={{ width: "100%", padding: 12, marginTop: 10, fontSize: 14, border: "1px solid var(--border)", borderRadius: 6 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, marginTop: 12, alignItems: "end" }}>
        <label><div className="signalTitle">Hard cost limit</div><input type="number" min="0" step="0.01" value={maxCost}
          onChange={e => setMaxCost(Number(e.target.value))} style={{ width: "100%", padding: 8 }} /></label>
        <label><div className="signalTitle">Max repair loops</div><input type="number" min="1" max="10" value={maxIterations}
          onChange={e => setMaxIterations(Number(e.target.value))} style={{ width: "100%", padding: 8 }} /></label>
        <button className="button" onClick={run} disabled={running || !task.trim()}>{running ? "Running…" : "Run agent →"}</button>
      </div>
    </section>

    {error && <section className="card" style={{ borderLeft: "3px solid #ef4444", marginBottom: 18 }}><p>{error}</p></section>}

    {!result && !error && <section className="card" style={{ marginBottom: 18 }}>
      <div className="crumb">WHAT HAPPENS NEXT</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 14 }}>
        {["PLAN", "ROUTE", "EXECUTE", "VERIFY", "PROVE"].map((step, i) =>
          <div key={step} style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 6 }}>
            <div className="signalTitle">0{i + 1}</div><strong>{step}</strong>
            <p className="sectionSub" style={{ marginTop: 5 }}>{["Understand the task", "Choose execution path", "Use bounded tools", "Test the result", "Return evidence"][i]}</p>
          </div>
        )}
      </div>
    </section>}

    {result && <>
      <section className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div className="crumb">02 / DECISION</div>
            <h2 className="sectionTitle" style={{ fontSize: 24, marginTop: 6 }}>{verified ? "Verified outcome" : "Not verified"}</h2>
            <p className="sectionSub" style={{ maxWidth: 650 }}>
              {verified ? "The task reached a verified completion state. The result is backed by the checks shown below."
                : "The system stopped without claiming success because the verification gates did not pass."}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="signalTitle">VERIFICATION</div>
            <div className="signalValue" style={{ fontSize: 28 }}>{verified ? "PASS" : "FAIL"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 18 }}>
          <div className="signal"><div className="signalTitle">TIME TO DECISION</div><div className="signalValue">{result.latency_ms != null ? (result.latency_ms / 1000).toFixed(2) : "—"}s</div></div>
          <div className="signal"><div className="signalTitle">COST</div><div className="signalValue">{"$" + (result.total_cost_usd ?? 0).toFixed(3)}</div></div>
          <div className="signal"><div className="signalTitle">QUALITY</div><div className="signalValue">{result.verification?.quality != null ? result.verification.quality.toFixed(2) : "—"}</div></div>
          <div className="signal"><div className="signalTitle">ITERATIONS</div><div className="signalValue">{result.iteration ?? "—"}</div></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="crumb">03 / PROOF</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 className="sectionTitle">Why can we trust this result?</h2>
          <span className="sectionSub">{result.verification?.checks?.length ?? 0} gates passed</span>
        </div>
        <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
          {(result.evidence ?? []).map((e, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "22px 190px 1fr", gap: 10, padding: 11, borderBottom: "1px solid var(--border)" }}>
            <strong>{e.status === "verified" ? "✓" : "×"}</strong><strong>{e.claim}</strong><span className="sectionSub">{e.evidence}</span>
          </div>)}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="crumb">04 / EXECUTION</div>
        <h2 className="sectionTitle">What the system actually did</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 14 }}>
          {(result.agents ?? []).map(a => <div key={a.role} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 6, minHeight: 90 }}>
            <div style={{ fontSize: 18 }}>{statusIcon(a.status)}</div><strong style={{ fontSize: 12 }}>{a.role}</strong>
            <p className="sectionSub" style={{ fontSize: 10, marginTop: 5 }}>{a.detail}</p>
          </div>)}
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="signalTitle">RUN TRAJECTORY</div>
          {(result.trajectory ?? []).map((t, i) => <div key={t.step + "-" + i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
            <strong>{statusIcon(t.status)} {t.step}</strong><span>{t.detail}</span><span className="sectionSub">iteration {t.iteration}</span>
          </div>)}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="crumb">05 / DECISION LEDGER</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 }}>
          <div className="signal"><div className="signalTitle">ACTION</div><div className="signalValue">{result.decision?.action ?? "—"}</div></div>
          <div className="signal"><div className="signalTitle">POLICY</div><div className="signalValue">{result.decision?.policy_action ?? "—"}</div></div>
          <div className="signal"><div className="signalTitle">RISK</div><div className="signalValue">{result.decision?.risk ?? "—"}</div></div>
          <div className="signal"><div className="signalTitle">EVIDENCE</div><div className="signalValue">{result.decision?.evidence_count ?? 0}</div></div>
        </div>
        <p className="sectionSub" style={{ marginTop: 12 }}><strong>{result.decision?.reason_code}</strong> — {result.decision?.reason}</p>
      </section>

      <details className="card" style={{ marginBottom: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Advanced runtime trace</summary>
        <pre style={{ background: "var(--bg-muted)", padding: 16, borderRadius: 6, whiteSpace: "pre-wrap", marginTop: 12 }}>{result.output}</pre>
      </details>
    </>}
  </div>;
}
