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

function traceStep(run: Run, names: string | string[]): string | null {
  const targets = new Set(Array.isArray(names) ? names : [names]);
  const value = evidenceTrace(run).find((entry) => targets.has(entry.step))?.detail;
  return typeof value === "string" && value.trim() ? value : null;
}

function categoryFromRun(run: Run): string {
  const match = run.externalId.match(/(?:bench|run)_[^_]+_(.+)-\d+$/i);
  return match?.[1] ?? "other";
}

function isPassed(run: Run): boolean {
  return run.status === "passed";
}

function isUnresolved(run: Run): boolean {
  return run.status === "unresolved" || run.selectedModel === "unresolved";
}

function hasEvidence(run: Run): boolean {
  const names = new Set(evidenceTrace(run).map((entry) => entry.step));
  return names.has("Expected reference") && names.has("Actual output") && names.has("Task-specific grader");
}

function pctFromCount(value: number, total: number): string {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "—";
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCategory(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

  const passedRuns = runs.filter(isPassed);
  const unresolvedRuns = runs.filter(isUnresolved);
  const evaluatedRuns = runs.filter((run) => !isUnresolved(run));
  const evaluatedFailures = evaluatedRuns.filter((run) => !isPassed(run));
  const evidenceRuns = runs.filter(hasEvidence).length;
  const evidenceCoverage = runs.length ? Math.round((evidenceRuns / runs.length) * 100) : null;
  const taskSuccess = pctFromCount(passedRuns.length, evaluatedRuns.length);

  const categoryFailures = useMemo(() => {
    const counts = new Map<string, number>();
    evaluatedFailures.forEach((run) => {
      const category = categoryFromRun(run);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [evaluatedFailures]);

  const trendValues = useMemo(
    () => runs.slice(0, 12).reverse().map((run) => Math.max(16, Math.round(run.quality * 190))),
    [runs],
  );

  const expectedReference = selectedRun ? traceStep(selectedRun, "Expected reference") : null;
  const actualOutput = selectedRun ? traceStep(selectedRun, "Actual output") : null;
  const grader = selectedRun ? traceStep(selectedRun, "Task-specific grader") : null;
  const selectionRationale = selectedRun
    ? traceStep(selectedRun, ["Routing decision", "Selected strategy", "Model selection", "Strategy decision"])
    : null;
  const selectedTask = selectedRun ? traceStep(selectedRun, "Task") ?? selectedRun.task ?? null : null;

  const attention = unresolvedRuns.length > 0 || evaluatedFailures.length > 0;
  const readoutTitle = !runs.length ? "No evaluation evidence yet" : attention ? "Action required" : "System on track";
  const readoutBody = !runs.length
    ? "Run a product task or benchmark to create auditable evidence."
    : unresolvedRuns.length > 0
      ? `${unresolvedRuns.length}/${runs.length} runs were not usable. Separate infrastructure recovery from model-quality tuning before changing the routing policy.`
      : evaluatedFailures.length > 0
        ? `${evaluatedFailures.length}/${evaluatedRuns.length} evaluated runs are failing task acceptance. Focus the next experiment on the dominant failure category.`
        : "All evaluated runs are passing. Continue watching quality and latency as the evidence set grows.";

  const recommendation = unresolvedRuns.length > 0
    ? "Fix response availability first"
    : categoryFailures[0]
      ? `Prioritize ${formatCategory(categoryFailures[0][0])}`
      : "Continue expanding the evaluation set";
  const recommendationDetail = unresolvedRuns.length > 0
    ? `${unresolvedRuns.length} runs are unresolved/provider-level failures. Model-quality metrics should not be tuned until recovery coverage improves.`
    : categoryFailures[0]
      ? `${categoryFailures[0][1]} evaluated failures currently concentrate in ${formatCategory(categoryFailures[0][0])}. Turn those failures into regression cases before changing routing.`
      : "There is not yet enough failure evidence to justify a routing-policy change.";

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
            Separate model quality from infrastructure reliability, explain every important decision, and turn failures into the next engineering experiment.
          </p>
        </div>
        <div className="heroActions">
          <Link href="/live" className="button">Try a product task</Link>
          <Link href="/benchmarks" className="button secondary">Run 50-case evaluation</Link>
        </div>
      </section>

      <section className="grid4" style={{ marginTop: 18 }}>
        <Metric label="Task success" value={taskSuccess} sub="Passed / evaluated only" />
        <Metric label="Quality" value={summary?.avgQuality == null ? "—" : `${(summary.avgQuality * 100).toFixed(1)}%`} sub="Evaluator score" />
        <Metric label="Reliability" value={pctFromCount(evaluatedRuns.length, runs.length)} sub="Runs reaching a usable response" />
        <Metric label="p95 latency" value={summary?.p95LatencyMs == null ? "—" : `${summary.p95LatencyMs}ms`} sub="Completed runs" />
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
            <Signal title="Passing" value={`${passedRuns.length}`} />
            <Signal title="Evaluated failures" value={`${evaluatedFailures.length}`} />
            <Signal title="Unresolved" value={`${unresolvedRuns.length}`} />
            <Signal title="Evidence-ready" value={`${evidenceRuns}/${runs.length || 0}`} />
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">RECOMMENDED ACTION</div>
          <h2 className="sectionTitle" style={{ marginBottom: 6 }}>{recommendation}</h2>
          <p className="sectionSub">{recommendationDetail}</p>
          <div className="policyGrid" style={{ marginTop: 14 }}>
            <div><b>Baseline delta</b><span>Not measured</span></div>
            <div><b>Cost delta</b><span>Not measured</span></div>
          </div>
          <p className="sectionSub" style={{ marginTop: 12 }}>
            No improvement claim is shown until fixed, cheapest-viable, and adaptive runs are persisted on the same task set.
          </p>
        </div>
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="eyebrow">FAILURE MIX</div>
          <h2 className="sectionTitle" style={{ marginBottom: 6 }}>What is actually breaking?</h2>
          <div className="listBlock" style={{ marginTop: 8 }}>
            <div className="listRow">
              <div className="topRow"><div className="listTitle">Infrastructure / unresolved</div><span className="pill">{unresolvedRuns.length}</span></div>
              <div className="sectionSub">Not usable for model-quality tuning.</div>
            </div>
            {categoryFailures.map(([category, count]) => (
              <div className="listRow" key={category}>
                <div className="topRow"><div className="listTitle">{formatCategory(category)}</div><span className="pill">{count}</span></div>
                <div className="sectionSub">Evaluated task failures.</div>
              </div>
            ))}
          </div>
          <Link href="/failures" className="textLink" style={{ display: "inline-block", marginTop: 10 }}>Open failure analysis →</Link>
        </div>

        <div className="card">
          <div className="eyebrow">AUDITABILITY</div>
          <h2 className="sectionTitle" style={{ marginBottom: 6 }}>{evidenceCoverage == null ? "—" : `${evidenceCoverage}%`} fully auditable</h2>
          <p className="sectionSub">{evidenceRuns}/{runs.length || 0} runs contain expected reference, actual output, and grader evidence.</p>
          <div className="signalGrid" style={{ marginTop: 14 }}>
            <Signal title="Evidence-ready" value={`${evidenceRuns}`} />
            <Signal title="Evidence gap" value={`${Math.max(0, runs.length - evidenceRuns)}`} />
          </div>
          <p className="sectionSub" style={{ marginTop: 12 }}>Evidence gaps are a product reliability issue: improve persistence before trusting trend analysis.</p>
        </div>
      </section>

      <section className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="topRow">
            <div>
              <p className="eyebrow">LATEST AI DECISION</p>
              <h2 className="sectionTitle">{selectedRun?.selectedModel ?? "No model selected"}</h2>
              <p className="sectionSub">Show the decision evidence first; raw provider details stay in the drill-down.</p>
            </div>
            {selectedRun && <span className="pill">{selectedRun.status}</span>}
          </div>
          {selectedRun ? (
            <div className="listBlock" style={{ marginTop: 8 }}>
              <div className="listRow"><div className="metricLabel">TASK</div><div className="listTitle">{selectedTask ?? "Not captured"}</div></div>
              <div className="listRow"><div className="metricLabel">OUTCOME</div><div className="listTitle">{(selectedRun.quality * 100).toFixed(1)}% quality · {selectedRun.latencyMs ? `${selectedRun.latencyMs}ms` : "no latency"}</div></div>
              <div className="listRow"><div className="metricLabel">SELECTION RATIONALE</div><div className="listTitle">{selectionRationale ?? "Not persisted for this run."}</div></div>
            </div>
          ) : <div className="empty">No persisted run to inspect.</div>}
        </div>

        <div className="card">
          <div className="topRow">
            <div>
              <p className="eyebrow">QUALITY TREND</p>
              <h2 className="sectionTitle">Recent persisted quality</h2>
              <p className="sectionSub">Trend is intentionally limited to the evidence currently persisted.</p>
            </div>
            <Link href="/runs" className="textLink">All runs →</Link>
          </div>
          {trendValues.length ? (
            <>
              <div className="trend" style={{ marginTop: 14 }}>
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
            <p className="sectionSub">Select a run to verify Expected → Actual → Grader without opening logs.</p>
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
              <p className="sectionSub">The source-of-truth view for the selected AI decision.</p>
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
