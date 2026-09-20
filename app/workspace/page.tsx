"use client";

import { useEffect, useMemo, useState } from "react";

type Evidence = { claim: string; evidence: string; status: string };
type Result = {
  task?: string;
  provenance?: string;
  run_id?: string;
  status?: string;
  loop_action?: string;
  iteration?: number;
  output?: string;
  trajectory?: { step: string; status: string; detail?: string; iteration?: number }[];
  decision?: {
    action?: string;
    policy_action?: string;
    reason_code?: string;
    reason?: string;
    risk?: string;
    evidence_count?: number;
  };
  verification?: { passed?: boolean; quality?: number; checks?: string[]; provenance?: string };
  evidence?: Evidence[];
  total_cost_usd?: number;
  latency_ms?: number;
  limits?: Record<string, number>;
};

const defaultTask =
  "Fix the failing CI contract test in the agent runtime, verify the fix, and stop only when the pipeline passes.";

const acceptanceChecks = [
  {
    label: "Root cause",
    detail: "Identify the failure from repository evidence, not model intuition.",
  },
  {
    label: "Minimal change",
    detail: "Produce the smallest corrective patch needed for the task.",
  },
  {
    label: "Verification",
    detail: "Run the required checks and surface the actual pass/fail state.",
  },
  {
    label: "Completion proof",
    detail: "Do not declare DONE until the evidence gates pass.",
  },
];

function statusFor(result: Result | null) {
  if (!result) return "READY";
  if (result.verification?.passed) return "VERIFIED";
  return "STOPPED";
}

export default function ExecutionWorkspace() {
  const [task, setTask] = useState(defaultTask);
  const [demo, setDemo] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get("task");
    const mode = params.get("mode");
    if (incoming?.trim()) setTask(incoming);
    if (mode === "live") setDemo(false);
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const endpoint = demo ? "/api/agent/demo" : "/api/agent";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          task_type: "coding",
          constraints: {
            quality_floor: 0.7,
            max_cost_usd: 0.05,
            max_iterations: 3,
          },
        }),
      });
      if (!res.ok) throw new Error("Execution backend returned " + res.status);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the execution runtime.");
    } finally {
      setRunning(false);
    }
  }

  const verified = !!result?.verification?.passed;
  const evidenceCount = result?.evidence?.length ?? result?.verification?.checks?.length ?? 0;
  const output = result?.output ?? "No agent output returned yet.";
  const provenance = result?.provenance ?? result?.verification?.provenance ?? "UNKNOWN";
  const status = statusFor(result);

  const trace = useMemo(() => {
    const items = result?.trajectory ?? [];
    const labels: Record<string, string> = {
      planner: "Plan",
      investigator: "Investigate",
      implementer: "Implement",
      tester: "Verify",
      repairer: "Repair",
      reviewer: "Review",
      verifier: "Final verification",
      loop: "Completion gate",
    };
    return items.map((item, index) => ({
      ...item,
      index: index + 1,
      label: labels[item.step] ?? item.step,
    }));
  }, [result]);

  return (
    <main className="executionWorkspace">
      <header className="workspaceNav">
        <div className="workspaceBrand">
          <span className="workspaceMark">A</span>
          <div>
            <strong>Agent Eval Router</strong>
            <small>Execution workspace</small>
          </div>
        </div>

        <div className="workspaceNavCenter">
          <span className={demo ? "workspaceMode demo" : "workspaceMode live"}>
            {demo ? "SIMULATED RUNTIME" : "LIVE RUNTIME"}
          </span>
          <span className="workspaceStatus">
            <i className={status === "VERIFIED" ? "good" : status === "STOPPED" ? "bad" : ""} />
            {running ? "EXECUTING" : status}
          </span>
        </div>

        <div className="workspaceNavActions">
          <button onClick={() => setDemo((value) => !value)}>{demo ? "Switch to live" : "Use demo"}</button>
          <a href="/">Back to product ↗</a>
        </div>
      </header>

      <section className="workspaceHero">
        <div>
          <span className="workspaceKicker">AUTONOMOUS WORK / PROOF-FIRST EXECUTION</span>
          <h1>Show the work.<br /><em>Then show why it is done.</em></h1>
          <p>
            This view separates the agent's claimed output from the acceptance contract and
            the evidence that permits a final decision.
          </p>
        </div>
        <div className="workspaceHeroNote">
          <span>CTO VIEW</span>
          <strong>Expected → Delivered → Verified</strong>
          <small>The router is intentionally pushed into the background.</small>
        </div>
      </section>

      <section className="workspaceGrid">
        <aside className="workspaceColumn requestColumn">
          <div className="workspacePanel requestPanel">
            <div className="workspacePanelHead">
              <span>01 / REQUEST</span>
              <b>WHAT THE USER ASKED</b>
            </div>
            <label htmlFor="workspace-task">ENGINEERING TASK</label>
            <textarea id="workspace-task" value={task} onChange={(e) => setTask(e.target.value)} />
            <div className="workspaceControls">
              <div>
                <span>CONTROL POLICY</span>
                <strong>Quality ≥ 70% · max 3 repair loops · $0.05 cap</strong>
              </div>
              <button className="workspaceRun" onClick={run} disabled={running || !task.trim()}>
                {running ? "Executing…" : "Execute task →"}
              </button>
            </div>
          </div>

          <div className="workspacePanel expectedPanel">
            <div className="workspacePanelHead">
              <span>02 / ACCEPTANCE CONTRACT</span>
              <b>WHAT “DONE” MEANS</b>
            </div>
            <div className="acceptanceList">
              {acceptanceChecks.map((item, index) => (
                <div className="acceptanceItem" key={item.label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="workspaceColumn outcomeColumn">
          <div className="workspacePanel outcomePanel">
            <div className="workspacePanelHead">
              <span>03 / DELIVERED</span>
              <b>WHAT THE AGENT ACTUALLY RETURNED</b>
              {result && <small>{provenance}</small>}
            </div>

            {!result ? (
              <div className="emptyOutcome">
                <div className="emptyGlyph">→</div>
                <h2>No execution yet</h2>
                <p>Run the task to populate the claimed output, execution trace and verification evidence.</p>
              </div>
            ) : (
              <>
                <div className="outcomeBanner">
                  <div>
                    <span>RUN RESULT</span>
                    <strong>{verified ? "Candidate outcome produced" : "Execution stopped without proof"}</strong>
                  </div>
                  <span className={verified ? "outcomeState good" : "outcomeState bad"}>{verified ? "PASS" : "REVIEW"}</span>
                </div>

                <div className="artifactBlock">
                  <div className="artifactHead">
                    <span>AGENT OUTPUT</span>
                    <small>CLAIM — not sufficient by itself</small>
                  </div>
                  <pre>{output}</pre>
                </div>

                <div className="traceBlock">
                  <div className="artifactHead">
                    <span>EXECUTION TRACE</span>
                    <small>{trace.length} recorded stages</small>
                  </div>
                  <div className="workspaceTrace">
                    {trace.map((item) => (
                      <div
                        className={
                          item.status === "failed"
                            ? "traceItem failed"
                            : item.status === "passed" || item.status === "complete"
                            ? "traceItem passed"
                            : "traceItem"
                        }
                        key={item.step + "-" + item.index}
                      >
                        <span>{String(item.index).padStart(2, "0")}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.detail ?? "No detail recorded."}</small>
                        </div>
                        <b>{item.status.toUpperCase()}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="workspaceColumn proofColumn">
          <div className={verified ? "workspacePanel proofPanel verified" : "workspacePanel proofPanel"}>
            <div className="workspacePanelHead">
              <span>04 / PROOF</span>
              <b>WHY THE SYSTEM CAN SAY DONE</b>
            </div>

            <div className="proofDecision">
              <span>FINAL DECISION</span>
              <strong>{status}</strong>
              <small>{result?.decision?.reason ?? "Verification evidence will determine the final decision."}</small>
            </div>

            <div className="proofFacts">
              <div><span>QUALITY</span><strong>{result?.verification?.quality != null ? String(Math.round(result.verification.quality * 100)) + "%" : "—"}</strong></div>
              <div><span>EVIDENCE</span><strong>{String(evidenceCount)}</strong></div>
              <div><span>ITERATIONS</span><strong>{result?.iteration != null ? String(result.iteration) : "—"}</strong></div>
              <div><span>COST</span><strong>{result?.total_cost_usd != null ? "$" + result.total_cost_usd.toFixed(3) : "—"}</strong></div>
            </div>

            <div className="proofChecks">
              <div className="artifactHead">
                <span>VERIFICATION GATES</span>
                <small>Independent of the agent's prose</small>
              </div>
              {(result?.verification?.checks ?? acceptanceChecks.map((item) => item.label)).map((check, index) => {
                const isPassed = verified;
                return (
                  <div className={isPassed ? "proofCheck passed" : "proofCheck"} key={check + "-" + index}>
                    <span>{isPassed ? "✓" : "•"}</span>
                    <strong>{check.replaceAll("_", " ")}</strong>
                    <small>{isPassed ? "PASSED" : "PENDING"}</small>
                  </div>
                );
              })}
            </div>

            <div className="evidenceBlock">
              <div className="artifactHead">
                <span>EVIDENCE LEDGER</span>
                <small>{String(evidenceCount)} claims</small>
              </div>
              {(result?.evidence ?? []).map((item, index) => (
                <div className="workspaceEvidence" key={item.claim + "-" + index}>
                  <span>{item.status === "verified" ? "✓" : "×"}</span>
                  <div>
                    <strong>{item.claim}</strong>
                    <p>{item.evidence}</p>
                  </div>
                </div>
              ))}
              {!result?.evidence?.length && <p className="emptyEvidence">Evidence appears after execution.</p>}
            </div>
          </div>
        </aside>
      </section>

      <section className="workspaceReceipt">
        <div className="receiptTitle">
          <span>EXECUTION RECEIPT</span>
          <strong>{result ? (verified ? "Proof-backed completion" : "Incomplete execution") : "Waiting for run"}</strong>
        </div>
        <div className="receiptStats">
          <div><span>RUN ID</span><strong>{result?.run_id ?? "—"}</strong></div>
          <div><span>LATENCY</span><strong>{result?.latency_ms != null ? String((result.latency_ms / 1000).toFixed(2)) + "s" : "—"}</strong></div>
          <div><span>DECISION</span><strong>{result?.decision?.action ?? "—"}</strong></div>
          <div><span>POLICY</span><strong>{result?.decision?.policy_action ?? "—"}</strong></div>
          <div><span>RISK</span><strong>{result?.decision?.risk ?? "—"}</strong></div>
        </div>
      </section>

      {error && (
        <div className="workspaceError">
          <strong>Execution error</strong>
          <span>{error}</span>
        </div>
      )}

      <footer className="workspaceFooter">
        <span>NO PROOF → NO DONE.</span>
        <span>{demo ? "Demo mode — results are explicitly simulated." : "Live mode — provider/runtime behavior depends on configured infrastructure."}</span>
      </footer>
    </main>
  );
}
