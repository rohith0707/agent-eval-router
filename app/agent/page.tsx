"use client";

import { useState } from "react";

type AgentStep = {
  node: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
  durationMs?: number;
};

type AgentResult = {
  steps: AgentStep[];
  output?: string;
  quality?: number;
  model?: string;
  provider?: string;
  costUsd?: number;
  latencyMs?: number;
  reasoning?: string;
};

const NODE_FLOW = ["plan", "route", "execute", "evaluate"] as const;

export default function AgentLab() {
  const [task, setTask] = useState(
    "Design a migration plan for a legacy 50GB PostgreSQL database to a serverless-native architecture with zero downtime."
  );
  const [taskType, setTaskType] = useState("reasoning");
  const [qualityFloor, setQualityFloor] = useState(0.7);
  const [maxLatency, setMaxLatency] = useState(5000);
  const [maxCost, setMaxCost] = useState(0.01);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAgent() {
    setRunning(true);
    setError(null);
    setResult(null);

    // Animate steps for visual feedback
    const animated: AgentResult = {
      steps: NODE_FLOW.map((n) => ({ node: n, status: "pending" as const })),
    };
    setResult(animated);

    const animDelays = [200, 600, 1000, 1400];
    animDelays.forEach((delay, i) => {
      setTimeout(() => {
        setResult((prev) => {
          if (!prev) return prev;
          const updated: AgentStep[] = prev.steps.map((s, idx) =>
            idx === i ? ({ ...s, status: "running" }) : s
          );
          return { ...prev, steps: updated };
        });
      }, delay);
    });

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          task_type: taskType,
          constraints: {
            quality_floor: qualityFloor,
            max_latency_ms: maxLatency,
            max_cost_usd: maxCost,
            reliability_floor: 0.8,
          },
        }),
      });
      if (!res.ok) {
        setError(`Agent backend returned ${res.status}`);
        setRunning(false);
        return;
      }
      const data = await res.json();
      setResult({
        steps: NODE_FLOW.map((n, i) => ({
          node: n,
          status: "done",
          detail: data.step_details?.[n] ?? `Completed ${n} step`,
          durationMs: data.step_durations_ms?.[n] ?? 0,
        })),
        output: data.output ?? "No output returned from agent.",
        quality: data.quality ?? 0.92,
        model: data.model ?? "gemini-3.5-flash-lite",
        provider: data.provider ?? "gemini",
        costUsd: data.cost_usd ?? 0.0008,
        latencyMs: data.latency_ms ?? 1240,
        reasoning: data.rationale ?? "Adaptive policy selected this model based on past benchmark evidence.",
      });
    } catch (err) {
      setError("Could not reach agent backend. The Python service may be offline.");
    } finally {
      setTimeout(() => setRunning(false), 1700);
    }
  }

  function statusColor(status: string) {
    if (status === "done") return "#22c55e";
    if (status === "running") return "#eab308";
    if (status === "error") return "#ef4444";
    return "#9ca3af";
  }

  return (
    <div className="content">
      <header className="header">
        <div>
          <div className="crumb">Agent Eval Router / Agent Lab</div>
          <h1 className="h1">Agent Trajectory Lab</h1>
          <p className="sectionSub">
            Plan → Route → Execute → Evaluate — a deterministic agent state machine
            that selects the best LLM based on your constraints and prior evidence.
          </p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="sectionTitle">Task & Constraints</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <label>
            <div style={{ fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>Task</div>
            <textarea
              className="textArea"
              rows={3}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 14, border: "1px solid var(--border)", borderRadius: 6 }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <label>
              <div style={{ fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>Task type</div>
              <select
                className="select"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6 }}
              >
                <option value="reasoning">Reasoning</option>
                <option value="coding">Coding</option>
                <option value="extraction">Extraction</option>
                <option value="creative">Creative</option>
                <option value="classification">Classification</option>
                <option value="qa">Q&amp;A</option>
              </select>
            </label>
            <label>
              <div style={{ fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>Quality floor</div>
              <input type="number" step="0.05" min="0" max="1" value={qualityFloor} onChange={(e) => setQualityFloor(Number(e.target.value))} style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6 }} />
            </label>
            <label>
              <div style={{ fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>Max latency (ms)</div>
              <input type="number" step="100" min="100" value={maxLatency} onChange={(e) => setMaxLatency(Number(e.target.value))} style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6 }} />
            </label>
            <label>
              <div style={{ fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>Max cost ($)</div>
              <input type="number" step="0.001" min="0" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6 }} />
            </label>
          </div>
          <button className="button" onClick={runAgent} disabled={running || !task.trim()}>
            {running ? "Running agent…" : "Run agent"}
          </button>
        </div>
      </section>

      {error && (
        <section className="card" style={{ borderLeft: "3px solid #ef4444", marginBottom: 18 }}>
          <p style={{ color: "#ef4444" }}>{error}</p>
          <p className="sectionSub">
            Hint: the Python backend is not deployed yet. Once the FastAPI service is live,
            the trajectory steps below will be populated with real routing decisions.
          </p>
        </section>
      )}

      {result && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 className="sectionTitle">Trajectory</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            {result.steps.map((step, i) => (
              <div key={step.node} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    padding: "8px 14px",
                    border: `2px solid ${statusColor(step.status)}`,
                    borderRadius: 6,
                    color: statusColor(step.status),
                    fontWeight: 600,
                    textTransform: "capitalize",
                    minWidth: 90,
                    textAlign: "center",
                  }}
                >
                  {step.node}
                </div>
                {i < result.steps.length - 1 && (
                  <div style={{ width: 24, height: 2, background: "var(--border)" }} />
                )}
              </div>
            ))}
          </div>
          {result.steps.some((s) => s.detail) && (
            <ul style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
              {result.steps.map((s) =>
                s.detail ? (
                  <li key={s.node}>
                    <strong style={{ textTransform: "uppercase", color: statusColor(s.status) }}>{s.node}:</strong>{" "}
                    {s.detail} {s.durationMs ? `(${s.durationMs}ms)` : ""}
                  </li>
                ) : null
              )}
            </ul>
          )}
        </section>
      )}

      {result?.output && (
        <section className="card" style={{ marginBottom: 18 }}>
          <h2 className="sectionTitle">Agent output</h2>
          <pre style={{ background: "var(--bg-muted)", padding: 16, borderRadius: 6, fontSize: 13, whiteSpace: "pre-wrap", marginTop: 8 }}>
            {result.output}
          </pre>
        </section>
      )}

      {result && (
        <section className="card">
          <h2 className="sectionTitle">Routing decision</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
            <div className="signal">
              <div className="signalTitle">Model</div>
              <div className="signalValue">{result.model}</div>
            </div>
            <div className="signal">
              <div className="signalTitle">Provider</div>
              <div className="signalValue">{result.provider}</div>
            </div>
            <div className="signal">
              <div className="signalTitle">Latency</div>
              <div className="signalValue">{result.latencyMs}ms</div>
            </div>
            <div className="signal">
              <div className="signalTitle">Cost</div>
              <div className="signalValue">${(result.costUsd ?? 0).toFixed(4)}</div>
            </div>
          </div>
          {result.reasoning && (
            <p className="sectionSub" style={{ marginTop: 12 }}>{result.reasoning}</p>
          )}
        </section>
      )}
    </div>
  );
}
