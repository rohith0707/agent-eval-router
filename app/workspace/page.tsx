"use client";

import { useEffect, useMemo, useState } from "react";

type Evidence = { claim: string; evidence: string; status: string };
type Deliverable = {
  type?: string;
  title?: string;
  summary?: string;
  sections?: { title: string; body: string }[];
};
type Result = {
  task?: string;
  repository?: {
    url?: string;
    defaultBranch?: string;
    inspectedFiles?: string[];
    rootFileCount?: number;
    provenance?: string;
  };
  task_type?: string;
  provenance?: string;
  run_id?: string;
  status?: string;
  loop_action?: string;
  iteration?: number;
  output?: string;
  deliverable?: Deliverable;
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
};

const defaultTask =
  "Fix the failing CI contract test in the agent runtime, verify the fix, and stop only when the pipeline passes.";

const engineeringAcceptance = [
  ["Root cause", "Failure identified from evidence"],
  ["Change", "Minimal corrective artifact"],
  ["Verification", "Required checks pass"],
  ["Completion", "Evidence supports the decision"],
];

const researchAcceptance = [
  ["Scope", "Question and requested outcome identified"],
  ["Answer", "Structured result returned"],
  ["Evidence", "Current factual claims separated from assumptions"],
  ["Completion", "Result boundary is explicit"],
];

function statusFor(result: Result | null) {
  if (!result) return "READY";
  return result.verification?.passed ? "VERIFIED" : "REVIEW";
}

export default function ExecutionWorkspace() {
  const [task, setTask] = useState(defaultTask);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"result" | "activity" | "evidence">("result");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get("task");
    const mode = params.get("mode");
    if (incoming?.trim()) setTask(incoming);
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    setActiveTab("result");
    try {
      const endpoint = "/api/agent";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          task_type: "auto",
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

  const status = statusFor(result);
  const verified = status === "VERIFIED";
  const evidence = result?.evidence ?? [];
  const checks = result?.verification?.checks ?? [];
  const acceptance = result?.task_type === "research" ? researchAcceptance : engineeringAcceptance;

  const trace = useMemo(() => {
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
    return (result?.trajectory ?? []).map((item, index) => ({
      ...item,
      number: String(index + 1).padStart(2, "0"),
      label: labels[item.step] ?? item.step,
    }));
  }, [result]);

  const runLabel = result?.task_type ? result.task_type.toUpperCase() : "READY";

  return (
    <main className="workspaceV2">
      <header className="workspaceTopbar">
        <a className="workspaceBrandV2" href="/">
          <span className="workspaceLogoV2">A</span>
          <span><strong>Agent Eval Router</strong><small>Execution workspace</small></span>
        </a>
        <div className="workspaceTopMeta">
          <span className="modeBadge live">LIVE RUNTIME</span>
          <span className="taskTypeBadge">{runLabel}</span>
          <span className="statusBadge"><i className={verified ? "ok" : status === "REVIEW" ? "bad" : ""} />{running ? "RUNNING" : status}</span>
        </div>
        <div className="workspaceTopActions">
          <a href="/">Product ↗</a>
        </div>
      </header>

      <section className="workspaceIntroV2">
        <div>
          <span className="eyebrowV2">EXECUTION / OUTCOME / PROOF</span>
          <h1>One task. One result.<br /><em>Every claim has a check.</em></h1>
          <p>Turn an agent request into a visible outcome, the artifact it produced, and the evidence behind the final decision.</p>
        </div>
        <div className="introState">
          <span>EXECUTION STATE</span>
          <strong>{running ? "Processing request" : verified ? "Verified outcome" : result ? "Needs review" : "Ready for work"}</strong>
          <small>{result?.provenance === "VERIFICATION_INCOMPLETE" ? "Completion withheld because independent verification is unavailable." : "Live runtime"}</small>
        </div>
      </section>

      <section className="workspaceShellV2">
        <aside className="requestRailV2">
          <section className="surfaceV2 requestSurface">
            <div className="surfaceHeaderV2">
              <span>REQUEST</span>
              <b>USER TASK</b>
            </div>
            <textarea value={task} onChange={(e) => setTask(e.target.value)} aria-label="User task" />
            <div className="requestRunV2">
              <div>
                <span>GUARDRAILS</span>
                <strong>Quality 70% · 3 loops · $0.05</strong>
              </div>
              <button onClick={run} disabled={running || !task.trim()}>
                {running ? "Running…" : "Run task"}
              </button>
            </div>
          </section>

          <section className="surfaceV2 acceptanceSurface">
            <div className="surfaceHeaderV2">
              <span>ACCEPTANCE</span>
              <b>WHAT COUNTS AS DONE</b>
            </div>
            <div className="acceptanceV2">
              {acceptance.map(([name, detail], index) => (
                <div key={name}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{name}</strong><small>{detail}</small></div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="mainResultV2">
          <section className="surfaceV2 resultSurfaceV2">
            <div className="resultHeaderV2">
              <div>
                <span className="resultEyebrowV2">DELIVERABLE</span>
                <h2>{result?.deliverable?.title ?? "Your result will appear here"}</h2>
                <p>{result?.deliverable?.summary ?? "Run a task to see the structured outcome, execution path, and verification evidence."}</p>
              </div>
              <div className={verified ? "decisionPill verified" : "decisionPill"}>{verified ? "VERIFIED" : result ? "REVIEW" : "READY"}</div>
            </div>

            <div className="resultTabsV2" role="tablist">
              <button className={activeTab === "result" ? "active" : ""} onClick={() => setActiveTab("result")}>Result</button>
              <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>Activity</button>
              <button className={activeTab === "evidence" ? "active" : ""} onClick={() => setActiveTab("evidence")}>Evidence</button>
            </div>

            {activeTab === "result" && (
              <div className="resultBodyV2">
                <div className="artifactSummaryV2">
                  <span>{result?.deliverable?.type ?? "OUTPUT"}</span>
                  <strong>{result?.task_type ? result.task_type + " workflow" : "Execution result"}</strong>
                  <p>{result?.output ?? "No result has been produced yet."}</p>
                </div>

                {result?.repository && (
                  <div className="repositoryContextV2">
                    <div>
                      <span>REPOSITORY CONTEXT</span>
                      <strong>{result.repository.url}</strong>
                      <small>
                        Inspected {result.repository.inspectedFiles?.length ?? 0} relevant files on{" "}
                        {result.repository.defaultBranch ?? "the default branch"} · read-only
                      </small>
                    </div>
                    <span className="repositoryBadge">LIVE GITHUB</span>
                  </div>
                )}

                <div className="artifactSectionsV2">
                  {(result?.deliverable?.sections ?? []).map((section) => (
                    <article key={section.title}>
                      <span>{section.title}</span>
                      <p>{section.body}</p>
                    </article>
                  ))}
                  {!result && (
                    <article className="placeholderSectionV2">
                      <span>EXPECTED ARTIFACT</span>
                      <p>The final artifact changes with the task. Coding tasks produce changes and checks; research tasks produce a structured brief; other work can produce the appropriate output type.</p>
                    </article>
                  )}
                </div>
              </div>
            )}

            {activeTab === "activity" && (
              <div className="activityV2">
                {trace.length === 0 ? (
                  <div className="emptyStateV2">No execution activity yet.</div>
                ) : (
                  trace.map((item) => (
                    <div className={"activityItemV2 " + (item.status === "failed" ? "failed" : item.status === "passed" ? "passed" : "")} key={item.number + item.step}>
                      <span>{item.number}</span>
                      <div><strong>{item.label}</strong><small>{item.detail ?? "No detail recorded."}</small></div>
                      <b>{item.status.toUpperCase()}</b>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="evidenceTabV2">
                {evidence.length === 0 ? (
                  <div className="emptyStateV2">Evidence appears after execution.</div>
                ) : (
                  evidence.map((item, index) => (
                    <div className="evidenceRowV2" key={item.claim + index}>
                      <span>{item.status === "verified" ? "✓" : "!"}</span>
                      <div><strong>{item.claim}</strong><small>{item.evidence}</small></div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <section className="surfaceV2 receiptSurfaceV2">
            <div><span>RUN</span><strong>{result?.run_id ?? "—"}</strong></div>
            <div><span>LATENCY</span><strong>{result?.latency_ms != null ? (result.latency_ms / 1000).toFixed(2) + "s" : "—"}</strong></div>
            <div><span>COST</span><strong>{result?.total_cost_usd != null ? "$" + result.total_cost_usd.toFixed(3) : "—"}</strong></div>
            <div><span>ITERATIONS</span><strong>{result?.iteration != null ? String(result.iteration) : "—"}</strong></div>
          </section>
        </section>

        <aside className="verifyRailV2">
          <section className={"surfaceV2 verifySurfaceV2 " + (verified ? "verified" : "")}>
            <div className="surfaceHeaderV2">
              <span>VERIFICATION</span>
              <b>DECISION</b>
            </div>
            <div className="decisionHeroV2">
              <small>FINAL STATUS</small>
              <strong>{status}</strong>
              <p>{result?.decision?.reason ?? "Run the task to calculate the final decision."}</p>
            </div>

            <div className="verifyMetricsV2">
              <div><span>QUALITY</span><strong>{result?.verification?.quality != null ? Math.round(result.verification.quality * 100) + "%" : "—"}</strong></div>
              <div><span>EVIDENCE</span><strong>{String(evidence.length)}</strong></div>
              <div><span>RISK</span><strong>{result?.decision?.risk ?? "—"}</strong></div>
              <div><span>POLICY</span><strong>{result?.decision?.policy_action ?? "—"}</strong></div>
            </div>

            <div className="checkListV2">
              <div className="checkListHeaderV2"><span>CHECKS</span><small>{checks.length} gates</small></div>
              {(checks.length ? checks : acceptance.map(([name]) => name)).map((check, index) => (
                <div className={verified ? "checkRowV2 pass" : "checkRowV2"} key={check + index}>
                  <span>{verified ? "✓" : "•"}</span>
                  <strong>{check}</strong>
                  <small>{verified ? "PASS" : "WAIT"}</small>
                </div>
              ))}
            </div>

            <div className="proofNoteV2">
              <span>DECISION BASIS</span>
              <strong>{result?.decision?.reason_code ?? "Awaiting verification"}</strong>
              <small>{result?.provenance === "SIMULATED_DEMO" ? "Simulated result. No external system was changed." : "Runtime-backed result."}</small>
            </div>
          </section>
        </aside>
      </section>

      {error && <div className="workspaceErrorV2"><strong>Execution error</strong><span>{error}</span></div>}

      <footer className="workspaceFooterV2">
        <span>NO PROOF → NO DONE.</span>
        <span>Live runtime — completion requires independent verification.</span>
      </footer>
    </main>
  );
}
