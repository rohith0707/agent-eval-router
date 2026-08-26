"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DashboardShell from "./components/DashboardShell";

type EvidenceTrace = {
  step: string;
  status: string;
  detail?: string;
};

type Run = {
  externalId: string;
  selectedModel: string;
  quality: number;
  latencyMs: number;
  status: string;
  task?: string;
  traceJson?: unknown;
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

function evidenceTrace(run: Run): EvidenceTrace[] {
  return Array.isArray(run.traceJson) ? (run.traceJson as EvidenceTrace[]) : [];
}

function traceStep(run: Run, name: string): string | null {
  const value = evidenceTrace(run).find((entry) => entry.step === name)?.detail;
  return typeof value === "string" && value.trim() ? value : null;
}

function categoryFromRun(run: Run): string {
  const match = run.externalId.match(/(?:bench|run)_[^_]+_(.+)-\d+$/i);
  return match?.[1] ?? "other";
}

function isPassed(run: Run): boolean {
  return run.status === "passed";
}

function hasEvidence(run: Run): boolean {
  const names = new Set(evidenceTrace(run).map((entry) => entry.step));
  return names.has("Expected reference") && names.has("Actual output") && names.has("Task-specific grader");
}

export default function Home() {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/runs", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: RunsResponse) => {
        if (!active) return;
        setData(payload);
        setError(payload.warning ?? "");
        if (payload.runs?.[0]) setSelectedRunId(payload.runs[0].externalId);
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
  const selectedRun = runs.find((run) => run.externalId === selectedRunId) ?? runs[0] ?? null;
  const failedRuns = runs.filter((run) => !isPassed(run));
  const evidenceRuns = runs.filter(hasEvidence).length;
  const evidenceCoverage = runs.length ? Math.round((evidenceRuns / runs.length) * 100) : null;

  const failureGroups = useMemo(() => {
    const counts = new Map<string, number>();
    failedRuns.forEach((run) => {
      const category = categoryFromRun(run);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [failedRuns]);

  const trendValues = useMemo(
    () => runs.slice(0, 12).reverse().map((run) => Math.max(16, Math.round(run.quality * 190))),
    [runs],
  );

  const expectedReference = selectedRun ? traceStep(selectedRun, "Expected reference") : null;
  const actualOutput = selectedRun ? traceStep(selectedRun, "Actual output") : null;
  const grader = selectedRun ? traceStep(selectedRun, "Task-specific grader") : null;
  const selectedTask = selectedRun ? traceStep(selectedRun, "Task") ?? selectedRun.task ?? null : null;
  const attention = failedRuns.length > 0;

  const readoutTitle = !runs.length ? "No evaluation evidence yet" : attention ? "Action required" : "System on track";
  const readoutBody = !runs.length
    ? "Run a product task or benchmark to create auditable evidence."
    : attention
      ? `${failedRuns.length} of ${runs.length} persisted runs are not passing. Review the failure concentration before changing the routing policy.`
      : "All persisted runs are passing. Continue watching quality and latency as the evidence set grows.";

  return (
    <DashboardShell
      title="AI Workspace"
      eyebrow="AI Engineer · Decision Workspace"
      action={<Link href="/live" className="button">Open Product AI Lab</Link>}
    >
      {error && <div className="notice">{error}</div>}

      <section className="heroCard">
        <div>
          <p className="eyebrow">BUILD · EVALUATE · IMPROVE</p>
          <h2 className="heroTitle">Know whether the AI system is working before you change it.</h2>
          <p className="heroDesc">
            Real product tasks, task-specific evaluation, auditable evidence, and failure-driven improvement in one workspace.
          </p>
        </div>
        <div className="heroActions">
          <Link href="/live" className="button">Try a product task</Link>
          <Link href="/benchmarks" className="button secondary">Run 50-case evaluation</Link>
        </div>
      </section>

      <section className="grid4" style={{ marginTop: 18 }}>
        <Metric label="Task success" value={summary?.passRate == null ? "—" : `${(summary.passRate * 100).toFixed(1)}%`} sub="Persisted passing runs" />
        <Metric label="Quality" value={summary?.avgQuality == null ? "—" : `${(summary.avgQuality * 100).toFixed(1)}%`} sub="Evaluator score" />
        <Metric label="p95 latency" value={summary?.p95LatencyMs == null ? "—" : `${summary.p95LatencyMs}ms`} sub="Completed runs" />
        <Metric label="Evidence coverage" value={evidenceCoverage == null ? "—" : `${evidenceCoverage}%`} sub={`${evidenceRuns}/${runs.length || 0} runs fully auditable`} />
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <p className="eyebrow">EXECUTIVE READOUT</p>
              <h2 className="sectionTitle">{readoutTitle}</h2>
              <p className="sectionSub">{readoutBody}</p>
            </div>
            <span className="pill">{runs.length} runs</span>
          </div>
          <div className="signalGrid" style={{ marginTop: 16 }}>
            <Signal title="Passing" value={`${runs.filter(isPassed).length}`} />
            <Signal title="Needs attention" value={`${failedRuns.length}`} />
            <Signal title="Evidence-ready" value={`${evidenceRuns}`} />
            <Signal title="Models observed" value={`${new Set(runs.map((run) => run.selectedModel)).size}`} />
          </div>
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <p className="eyebrow">LATEST DECISION</p>
              <h2 className="sectionTitle">{selectedRun?.selectedModel ?? "No model selected"}</h2>
              <p className="sectionSub">The latest persisted run is the fastest way to audit what the system decided.</p>
            </div>
            <button className="textLink" onClick={() => selectedRun && setSelectedRunId(selectedRun.externalId)}>Inspect →</button>
          </div>
          {selectedRun ? (
            <div className="listBlock" style={{ marginTop: 8 }}>
              <div className="listRow"><div className="metricLabel">TASK</div><div className="listTitle">{selectedTask ?? "Not captured"}</div></div>
              <div className="listRow"><div className="metricLabel">OUTCOME</div><div className="listTitle">{(selectedRun.quality * 100).toFixed(1)}% quality · {selectedRun.latencyMs ? `${selectedRun.latencyMs}ms` : "no latency"}</div></div>
              <div className="listRow"><div className="metricLabel">STATUS</div><div className="listTitle">{selectedRun.status}</div></div>
            </div>
          ) : <div className="empty">No persisted run to inspect.</div>}
        </div>
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Failure concentration</h2>
              <p className="sectionSub">Where the current evidence set is breaking down.</p>
            </div>
            <Link href="/failures" className="textLink">Failure analysis →</Link>
          </div>
          {failureGroups.length ? (
            <div className="listBlock" style={{ marginTop: 8 }}>
              {failureGroups.map(([category, count]) => (
                <div className="listRow" key={category}>
                  <div className="listTitle">{category}</div>
                  <div className="sectionSub">{count} run{count === 1 ? "" : "s"} not passing</div>
                </div>
              ))}
            </div>
          ) : <div className="empty">No failing persisted runs in the current evidence set.</div>}
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <h2 className="sectionTitle">Quality trend</h2>
              <p className="sectionSub">Recent persisted evaluation quality.</p>
            </div>
            <Link href="/runs" className="textLink">All runs →</Link>
          </div>
          {trendValues.length ? (
            <>
              <div className="trend">
                {trendValues.map((value, index) => <div key={index} className="bar" style={{ height: `${value}px` }} />)}
              </div>
              <div className="axis"><span>Older</span><span>Recent</span></div>
            </>
          ) : <div className="empty">Run the Product AI Lab to create evidence.</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="topRow">
          <div>
            <p className="eyebrow">AUDIT TRAIL</p>
            <h2 className="sectionTitle">Recent evidence</h2>
            <p className="sectionSub">Every result is traceable to a real run. Select one to inspect Expected vs Actual below.</p>
          </div>
          <Link href="/runs" className="textLink">Open all runs →</Link>
        </div>
        {runs.length ? (
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Run</th><th>Strategy</th><th>Quality</th><th>Latency</th><th>Status</th><th /></tr></thead>
            <tbody>
              {runs.slice(0, 6).map((run) => (
                <tr key={run.externalId}>
                  <td>{run.externalId}</td>
                  <td>{run.selectedModel}</td>
                  <td>{(run.quality * 100).toFixed(1)}%</td>
                  <td>{run.latencyMs ? `${run.latencyMs}ms` : "—"}</td>
                  <td><span className="pill">{run.status}</span></td>
                  <td><button className="textLink" onClick={() => setSelectedRunId(run.externalId)}>Inspect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">No evaluation evidence yet.</div>}
      </section>

      {selectedRun && (
        <section className="card" style={{ marginTop: 18 }}>
          <div className="topRow">
            <div>
              <p className="eyebrow">EVIDENCE INSPECTOR</p>
              <h2 className="sectionTitle">Expected vs Actual</h2>
              <p className="sectionSub">A reviewer should be able to verify the task, reference, model output, and grader decision without opening logs.</p>
            </div>
            <span className="pill">{selectedRun.status}</span>
          </div>

          <div className="grid2" style={{ marginTop: 16 }}>
            <EvidenceBlock label="Task" value={selectedTask} empty="Task context was not captured for this run." />
            <EvidenceBlock label="Expected reference" value={expectedReference} empty="This is an older run; expected reference was not persisted." />
            <EvidenceBlock label="Actual model output" value={actualOutput} empty="No model output was captured." />
            <EvidenceBlock label="Grader decision" value={grader} empty="No task-specific grader evidence was persisted." />
          </div>
        </section>
      )}

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2 className="sectionTitle">The AI-engineering loop</h2>
          <p className="sectionSub">The product is the improvement loop, not the model list.</p>
          <div className="listBlock" style={{ marginTop: 8 }}>
            <div className="listRow"><div className="listTitle">1 · Understand the task</div><div className="sectionSub">Identify the quality bar, tools, latency target, and risk.</div></div>
            <div className="listRow"><div className="listTitle">2 · Execute an AI strategy</div><div className="sectionSub">Use the least expensive viable approach, or escalate when the task demands deeper reasoning.</div></div>
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
            <Link href="/live" className="textLink">Try a task →</Link>
          </div>
          <div className="signalGrid" style={{ marginTop: 12 }}>
            <Signal title="Investigation" value="Root-cause + evidence" />
            <Signal title="RAG" value="Grounded answers" />
            <Signal title="SQL" value="Safe, structured queries" />
            <Signal title="Agents" value="Tools + planning" />
          </div>
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

function EvidenceBlock({ label, value, empty }: { label: string; value: string | null; empty: string }) {
  return (
    <div className="card" style={{ background: "rgba(255,255,255,.015)" }}>
      <div className="metricLabel">{label}</div>
      {value ? <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.55 }}>{value}</pre> : <div className="empty" style={{ padding: "16px 0 0" }}>{empty}</div>}
    </div>
  );
}
