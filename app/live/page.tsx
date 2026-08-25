"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";

type Candidate = {
  model?: string;
  provider?: string;
  output?: string;
  quality?: number;
  latencyMs?: number;
  source?: string;
};

type Result = {
  runId?: string;
  provider?: string;
  persisted?: boolean;
  decision?: { selectedModel?: string; reason?: string };
  metrics?: {
    quality?: number;
    latencyMs?: number;
    fallbackCount?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  candidates?: Candidate[];
  trace?: Array<{ step: string; status: string; detail: string }>;
};

const presets = [
  {
    label: "Incident investigator",
    task: "Investigate a production incident. Use the evidence provided in the request, identify the most likely root cause, state what evidence supports it, and propose the safest next action.",
  },
  {
    label: "RAG reliability review",
    task: "Review a production RAG system and propose three concrete changes that improve retrieval quality, citation grounding, and failure recovery. State the trade-off for each change.",
  },
  {
    label: "Text-to-SQL",
    task: "Convert this request into a safe read-only SQL query: return the top 10 customers by revenue in the last 30 days, including customer name, total revenue, and order count. Do not mutate data.",
  },
  {
    label: "Agent planning",
    task: "Design a concise execution plan for an agent that investigates a failed payment. It can inspect logs, query a database, and review the latest deployment diff. Include tool ordering, verification steps, and a stop condition.",
  },
];

export default function LiveEvaluation() {
  const [task, setTask] = useState(presets[0].task);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const taskType = useMemo(() => {
    const text = task.toLowerCase();
    if (text.includes("sql")) return "Text-to-SQL";
    if (text.includes("rag") || text.includes("retrieval")) return "RAG";
    if (text.includes("agent") || text.includes("execution plan")) return "Agent planning";
    if (text.includes("incident") || text.includes("root cause")) return "Investigation";
    return "General reasoning";
  }, [task]);

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/live-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const text = await response.text();
      let data: Result & { error?: string };
      try {
        data = JSON.parse(text) as Result & { error?: string };
      } catch {
        throw new Error(`Evaluation API returned an invalid response (${response.status}).`);
      }
      if (!response.ok) throw new Error(data.error || "Evaluation failed. Please try again.");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell
      title="Product AI Lab"
      eyebrow="Evaluate"
      action={<Link href="/" className="button secondary">Back to overview</Link>}
    >
      <section className="heroCard">
        <div>
          <p className="eyebrow">REAL PRODUCT TASK</p>
          <h2 className="heroTitle">Build, test, and improve an AI workflow.</h2>
          <p className="heroDesc">
            Use a realistic product task, let the system choose a viable model strategy, then inspect the quality, latency, fallback behavior, and evidence behind the result.
          </p>
        </div>
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <div className="metricLabel">Task type</div>
              <div className="providerName">{taskType}</div>
            </div>
            <span className="pill">Product workflow</span>
          </div>
          <div className="presetGrid">
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.label}
                className="presetButton"
                onClick={() => setTask(preset.task)}
              >
                <strong>{preset.label}</strong>
                <span>Use a realistic evaluation case</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="metricLabel">What the system optimizes</div>
          <div className="listBlock">
            <Row title="Correctness" text="Solve the actual task, not just produce plausible text." />
            <Row title="Reliability" text="Recover from model/provider failures without leaking infrastructure errors." />
            <Row title="Efficiency" text="Prefer the least expensive viable strategy within the task constraints." />
            <Row title="Evidence" text="Keep the routing reason, evaluation result, and execution trace reproducible." />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <label className="fieldLabel">Task</label>
        <textarea value={task} onChange={(event) => setTask(event.target.value)} rows={7} className="textarea" />
        <div className="formBar">
          <span className="helper">No model selection. The system owns candidate selection and fallback.</span>
          <button onClick={run} disabled={loading || !task.trim()} className="button">
            {loading ? "Running product evaluation…" : "Run product evaluation"}
          </button>
        </div>
        {error && <div className="notice errorNotice">{error}</div>}
      </section>

      {result && (
        <div className="resultStack">
          <section className="grid4">
            <Metric label="Selected strategy" value={result.decision?.selectedModel ?? "—"} sub={result.provider ?? "—"} />
            <Metric label="Quality" value={result.metrics?.quality == null ? "—" : `${(result.metrics.quality * 100).toFixed(1)}%`} sub="Task-specific evaluation signal" />
            <Metric label="Latency" value={result.metrics?.latencyMs ? `${result.metrics.latencyMs}ms` : "—"} sub={`${result.metrics?.fallbackCount ?? 0} fallback(s)`} />
            <Metric label="Persistence" value={result.persisted ? "Saved" : "Not saved"} sub={result.runId ?? "—"} />
          </section>

          <section className="grid2">
            <div className="card">
              <h2 className="sectionTitle">Why this strategy won</h2>
              <p className="sectionSub">The decision is derived from the routing/evaluation pipeline.</p>
              <p className="bodyText">{result.decision?.reason ?? "No decision rationale recorded."}</p>
            </div>
            <div className="card">
              <h2 className="sectionTitle">Model output</h2>
              <pre className="outputBlock">{result.candidates?.[0]?.output || "No output"}</pre>
            </div>
          </section>

          <section className="card">
            <div className="topRow">
              <div>
                <h2 className="sectionTitle">Execution evidence</h2>
                <p className="sectionSub">A recruiter or engineer should be able to understand the AI behavior without reading server logs.</p>
              </div>
              <span className="pill">{result.runId ?? "run"}</span>
            </div>
            <div className="trace">
              {result.trace?.map((trace, index) => (
                <div className="traceItem" key={`${trace.step}-${index}`}>
                  <div className="traceMarker">{trace.status === "complete" ? "✓" : "•"}</div>
                  <div>
                    <div className="traceTitle">{trace.step}</div>
                    <div className="traceDetail">{trace.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="metricLabel">{label}</div>
      <div className="metricValue compact">{value}</div>
      <div className="metricDelta">{sub}</div>
    </div>
  );
}

function Row({ title, text }: { title: string; text: string }) {
  return (
    <div className="listRow">
      <div className="listTitle">{title}</div>
      <div className="sectionSub">{text}</div>
    </div>
  );
}
