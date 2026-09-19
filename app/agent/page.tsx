"use client";

import { useState } from "react";

type Agent = { role: string; status: string; detail?: string };
type Result = {
  task?: string;
  provenance?: string;
  run_id?: string;
  status?: string;
  loop_action?: string;
  iteration?: number;
  output?: string;
  agents?: Agent[];
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
  evidence?: { claim: string; evidence: string; status: string }[];
  total_cost_usd?: number;
  latency_ms?: number;
  limits?: Record<string, number>;
};

const demoTask =
  "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";

const roleDescriptions: Record<string, string> = {
  Planner: "Turns the job into bounded work.",
  Investigator: "Finds the failure and supporting evidence.",
  Implementer: "Applies the smallest corrective change.",
  Tester: "Challenges the proposed result.",
  Repairer: "Runs a bounded repair when verification fails.",
  Reviewer: "Attempts to disprove the repair.",
  Verifier: "Controls the final VERIFIED decision.",
  Orchestrator: "Selects the execution path.",
  "Tool Executor": "Runs only authorized tools.",
  "Repair Controller": "Controls bounded retry loops.",
  "Policy Gate": "Enforces execution limits.",
};

const stageOrder = [
  { key: "plan", label: "PLAN", aliases: ["plan", "planner"] },
  { key: "route", label: "ROUTE", aliases: ["route", "orchestrator", "investigator"] },
  { key: "execute", label: "EXECUTE", aliases: ["execute", "implementer"] },
  { key: "verify-first", label: "VERIFY", aliases: ["verify", "tester"], preferLast: false },
  { key: "repair", label: "REPAIR", aliases: ["repair", "repairer", "repair_controller"] },
  { key: "verify-final", label: "VERIFY", aliases: ["verifier", "reviewer", "verify"], preferLast: true },
];

function statusIcon(status: string) {
  if (status === "passed" || status === "complete") return "✓";
  if (status === "failed") return "×";
  return "•";
}

export default function AgentControlPlane() {
  const [task, setTask] = useState(demoTask);
  const [maxCost, setMaxCost] = useState(0.05);
  const [maxIterations, setMaxIterations] = useState(3);
  const [demo, setDemo] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            max_cost_usd: maxCost,
            max_iterations: maxIterations,
          },
        }),
      });
      if (!res.ok) throw new Error("Agent backend returned " + res.status);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach agent backend.");
    } finally {
      setRunning(false);
    }
  }

  const verified = !!result?.verification?.passed;
  const quality = result?.verification?.quality;
  const latency = result?.latency_ms;
  const cost = result?.total_cost_usd;
  const trajectory = result?.trajectory ?? [];
  const agents = result?.agents ?? [];
  const evidence = result?.evidence ?? [];

  return (
    <div className="controlPlane">
      <header className="controlHeader">
        <div>
          <div className="eyebrow">AGENT EVAL ROUTER / CONTROL PLANE</div>
          <div className="brandLine">
            <span className="brandPulse" />
            <span>Autonomous AI work, with proof.</span>
          </div>
        </div>
        <div className="runtimeSwitch">
          <span className={demo ? "modeActive" : ""}>{demo ? "DEMO" : "LIVE RUNTIME"}</span>
          <button className="ghostButton" onClick={() => setDemo(!demo)}>
            {demo ? "Switch to live" : "Use demo"}
          </button>
        </div>
      </header>

      <main className="controlContent">
        <section className="sixSecondHero">
          <div className="heroStory">
            <div className="heroEyebrow">AI WORK, WITH A STOP CONDITION</div>
            <h1>AI can do the work.<br /><em>We make it prove the work.</em></h1>
            <p className="heroLead">
              Give an AI a real engineering job. If it fails, the system repairs it.
              If the proof does not pass, it never gets to say <strong>DONE.</strong>
            </p>

            <div className="heroProofLine">
              <span>DO THE WORK</span><b>→</b><span>CATCH FAILURE</span><b>→</b><span>REPAIR</span><b>→</b><span>PROVE</span>
            </div>

            <div className="heroActions">
              <button className="runButton heroRun" onClick={run} disabled={running || !task.trim()}>
                {running ? "AI is working…" : "See the agent prove a fix →"}
              </button>
              <span className="heroSub">One run. One decision. Evidence attached.</span>
            </div>
          </div>

          <div className="proofDemo">
            <div className="proofDemoTop">
              <div>
                <span className="demoKicker">REAL ENGINEERING TASK</span>
                <strong>Fix failing CI</strong>
              </div>
              <span className="demoLive"><i /> {running ? "WORKING" : "READY"}</span>
            </div>

            <div className="demoTask">
              <span>INPUT</span>
              <p>{task}</p>
            </div>

            <div className="demoFlow">
              <div className="demoStep done"><b>01</b><span>Investigate</span><i>✓</i></div>
              <div className="demoStep done"><b>02</b><span>Change code</span><i>✓</i></div>
              <div className="demoStep repair"><b>03</b><span>Test fails</span><i>!</i></div>
              <div className="demoStep done"><b>04</b><span>Repair</span><i>✓</i></div>
              <div className="demoStep verified"><b>05</b><span>Prove result</span><i>✓</i></div>
            </div>

            <div className="demoOutcome">
              <div>
                <span>FINAL DECISION</span>
                <strong>VERIFIED</strong>
              </div>
              <div className="demoMetric"><span>TIME</span><b>seconds</b></div>
              <div className="demoMetric"><span>PROOF</span><b>attached</b></div>
            </div>
            <div className="demoTagline">No proof → no DONE.</div>
          </div>
        </section>

        <section className="whatThisIs">
          <div className="sectionEyebrow">THE PRODUCT IN ONE SENTENCE</div>
          <h2>An execution layer that <span>controls AI work from start to proof.</span></h2>
          <div className="threeAnswers">
            <div><b>WHAT GOES IN</b><strong>A job</strong><p>“Fix this CI failure.” “Review this change.” “Complete this task.”</p></div>
            <div><b>WHAT HAPPENS</b><strong>Work + repair</strong><p>Agents execute inside limits and recover from failed verification.</p></div>
            <div><b>WHAT COMES OUT</b><strong>Verified outcome</strong><p>A decision, measurable run, and evidence showing why it passed or stopped.</p></div>
          </div>
        </section>

        <section className="controlStrip">
          <div><span>CONTROL</span><strong>Cost + tool + retry limits</strong></div>
          <div><span>RECOVERY</span><strong>Bounded repair loops</strong></div>
          <div><span>VERIFICATION</span><strong>Evidence before success</strong></div>
          <div><span>RECORD</span><strong>Decision ledger</strong></div>
        </section>
        {error && (
          <section className="errorBanner">
            <strong>RUN FAILED</strong>
            <span>{error}</span>
          </section>
        )}

        {!result && !error && (
          <section className="preRunGrid">
            <div className="preRunCard">
              <div className="sectionEyebrow">WHAT MAKES THIS DIFFERENT</div>
              <h2>Execution is controlled, not just generated.</h2>
              <div className="controlPrinciples">
                <div><b>01</b><span><strong>Bounded work</strong> — limits define what the runtime can do.</span></div>
                <div><b>02</b><span><strong>Evidence</strong> — decisions carry checks and artifacts.</span></div>
                <div><b>03</b><span><strong>Repair</strong> — failures trigger bounded recovery, not blind retries.</span></div>
                <div><b>04</b><span><strong>Verification</strong> — no evidence, no VERIFIED state.</span></div>
              </div>
            </div>

            <div className="preRunCard previewCard">
              <div className="sectionEyebrow">THE RUN YOU ARE ABOUT TO SEE</div>
              <div className="previewMetric">
                <span>DECISION</span>
                <strong>VERIFIED</strong>
              </div>
              <div className="previewStats">
                <div><span>TIME</span><strong>seconds</strong></div>
                <div><span>COST</span><strong>measured</strong></div>
                <div><span>PROOF</span><strong>attached</strong></div>
              </div>
              <p>Run the demo to see the full execution trail, repair loop and evidence ledger.</p>
            </div>
          </section>
        )}

        {result && (
          <>
            <section className={verified ? "outcomeCard verified" : "outcomeCard failed"}>
              <div className="outcomeHeader">
                <div>
                  <div className="sectionEyebrow">01 / OUTCOME</div>
                  <div className="outcomeTitleRow">
                    <span className="outcomeIcon">{verified ? "✓" : "!"}</span>
                    <h2>{verified ? "VERIFIED" : "NOT VERIFIED"}</h2>
                  </div>
                  <p>
                    {verified
                      ? "The system completed the work and passed its verification gates."
                      : "The system stopped without claiming success because verification did not pass."}
                  </p>
                </div>
                <div className="decisionStamp">
                  <span>TIME TO VERIFIED DECISION</span>
                  <strong>{latency != null ? `${(latency / 1000).toFixed(2)}s` : "—"}</strong>
                </div>
              </div>

              <div className="outcomeMetrics">
                <div><span>COST</span><strong>{cost != null ? `\$${cost.toFixed(3)}` : "—"}</strong></div>
                <div><span>QUALITY</span><strong>{quality != null ? `${Math.round(quality * 100)}%` : "—"}</strong></div>
                <div><span>ITERATIONS</span><strong>{result.iteration ?? "—"}</strong></div>
                <div><span>EVIDENCE</span><strong>{result.decision?.evidence_count ?? evidence.length}</strong></div>
              </div>
            </section>

            <section className="executionCard">
              <div className="sectionHeader">
                <div>
                  <div className="sectionEyebrow">02 / EXECUTION</div>
                  <h2>Watch the work happen.</h2>
                </div>
                <span className="livePill"><i /> {running ? "RUNNING" : "RUN COMPLETE"}</span>
              </div>

              <div className="timeline">
                {stageOrder.map((stage, index) => {
                  const candidates = trajectory.filter((item) =>
                    stage.aliases.some((alias) => item.step === alias)
                  );
                  const displayItem = stage.preferLast ? candidates[candidates.length - 1] : candidates[0];
                  const stageStatus = displayItem?.status ?? "pending";
                  return (
                    <div className={`timelineStage ${stageStatus}`} key={stage.key}>
                      <div className="timelineNode">{statusIcon(stageStatus)}</div>
                      <div className="timelineText">
                        <strong>{stage.label}</strong>
                        <span>{displayItem?.detail ?? (stage.key === "repair" ? "Runs only when verification fails." : "Waiting for this stage.")}</span>
                      </div>
                      {displayItem?.iteration != null && <small>#{displayItem.iteration}</small>}
                    </div>
                  );
                })}
              </div>

              <div className="executionLower">
                <div className="rolePanel">
                  <div className="miniTitle">WHAT THE SYSTEM ACTUALLY DID</div>
                  <div className="roleList">
                    {agents.map((agent, index) => (
                      <div className="roleRow" key={`${agent.role}-${index}`}>
                        <span className={`roleStatus ${agent.status}`}>{statusIcon(agent.status)}</span>
                        <div>
                          <strong>{agent.role}</strong>
                          <p>{roleDescriptions[agent.role] ?? agent.detail}</p>
                        </div>
                        <span className="roleState">{agent.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="proofPanel">
                  <div className="miniTitle">WHY CAN WE TRUST THIS RESULT?</div>
                  <div className="proofCount">
                    <strong>{result.verification?.checks?.length ?? 0}</strong>
                    <span>verification gates</span>
                  </div>
                  <div className="proofList">
                    {evidence.map((item, index) => (
                      <div className="proofRow" key={`${item.claim}-${index}`}>
                        <span className="proofCheck">{item.status === "verified" ? "✓" : "×"}</span>
                        <div>
                          <strong>{item.claim}</strong>
                          <p>{item.evidence}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="ledgerCard">
              <div className="sectionHeader">
                <div>
                  <div className="sectionEyebrow">03 / DECISION LEDGER</div>
                  <h2>Every important decision leaves a record.</h2>
                </div>
                <span className="ledgerId">{result.run_id ?? "RUN"}</span>
              </div>

              <div className="ledgerGrid">
                <div><span>ACTION</span><strong>{result.decision?.action ?? "—"}</strong></div>
                <div><span>POLICY</span><strong>{result.decision?.policy_action ?? "—"}</strong></div>
                <div><span>RISK</span><strong>{result.decision?.risk ?? "—"}</strong></div>
                <div><span>REASON CODE</span><strong>{result.decision?.reason_code ?? "—"}</strong></div>
              </div>
              <div className="ledgerReason">
                <span>DECISION</span>
                <p>{result.decision?.reason ?? result.output ?? "No decision reason returned."}</p>
              </div>
            </section>

            <section className="taskReceipt">
              <div>
                <div className="sectionEyebrow">TASK RECEIPT</div>
                <strong>{result.task ?? task}</strong>
              </div>
              <button className="ghostButton" onClick={() => setResult(null)}>Run another job</button>
            </section>

            <details className="advancedTrace">
              <summary>Advanced runtime trace</summary>
              <pre>{result.output}</pre>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
