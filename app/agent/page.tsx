"use client";

import { useState } from "react";

type Agent = { role: string; status: string; detail?: string };
type RouterCard = { provider: string; label: string; model: string; status: string; outcome?: string; quality?: number; latencyMs?: number; costUsd?: number; score?: number; preview?: string; output?: string; error?: string; detail?: string; statusCode?: number; configured?: boolean; startedAt?: number; completedAt?: number };
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

const defaultTask =
  "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";

const taskExamples = [
  "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.",
  "Review this risky code change and identify what must be verified before it ships.",
  "Change my product from one model provider to another and give me the safest migration plan.",
  "Investigate a production error, identify likely causes, and define the checks needed before a fix is accepted.",
];

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
  const [task, setTask] = useState(defaultTask);
  const [maxCost, setMaxCost] = useState(0.05);
  const [maxIterations, setMaxIterations] = useState(3);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routerCards, setRouterCards] = useState<RouterCard[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouterCard | null>(null);
  const [routerRunning, setRouterRunning] = useState(false);
  const [parallelProof, setParallelProof] = useState<{ expectedProviders: number; configuredProviders: number; completedProviders: number; successfulProviders?: number; failedProviders?: number; maxConcurrent: number; wallClockMs: number; proof: string } | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
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

  async function runLiveRouter() {
    setRouterRunning(true);
    setRouterCards([]);
    setSelectedRoute(null);
    setParallelProof(null);
    setError(null);
    try {
      const response = await fetch("/api/router/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, max_cost_usd: maxCost, max_tokens: 256 }),
      });
      if (!response.ok || !response.body) throw new Error("Live router stream unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          const event = JSON.parse(raw);
          if (event.type === "start") {
            setRouterCards(event.providers.map((item: RouterCard) => ({ ...item, status: "running" })));
          } else if (event.type === "result") {
            setRouterCards((cards) => cards.map((card) => card.provider === event.provider ? { ...card, ...event } : card));
          } else if (event.type === "parallel_proof") {
            setParallelProof(event);
          } else if (event.type === "selected") {
            setSelectedRoute(event.provider ? event : null);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live router failed.");
    } finally {
      setRouterRunning(false);
    }
  }

  const verified = !!result?.verification?.passed;
  const quality = result?.verification?.quality;
  const latency = result?.latency_ms;
  const cost = result?.total_cost_usd;
  const trajectory = result?.trajectory ?? [];
  const agents = result?.agents ?? [];
  const evidence = result?.evidence ?? [];

  function openWorkspace() {
    const url = "/workspace?task=" + encodeURIComponent(task) + "&mode=live";
    const opened = window.open(url, "_blank", "noopener,noreferrer,width=1500,height=1000");
    if (!opened) window.location.href = url;
  }

  return (
    <div className="agentProduct">
      <header className="productNav">
        <a className="productBrand" href="#top">
          <span className="productMark">A</span>
          <span>
            <strong>Agent Eval Router</strong>
            <small>AI execution control plane</small>
          </span>
        </a>
        <nav className="productLinks" aria-label="Product navigation">
          <a href="#work">Workloads</a>
          <a href="#proof">Proof</a>
          <a href="#architecture">How it works</a>
          <a href="https://github.com/rohith0707/agent-eval-router" target="_blank" rel="noreferrer">GitHub ↗</a>
        </nav>
        <div className="productRuntime">
          <span className="runtimeMode active">LIVE RUNTIME</span>
        </div>
      </header>

      <main className="productMain" id="top">
        <section className="productHero">
          <div className="productHeroCopy">
            <div className="productKicker">AUTONOMOUS WORK / EXECUTION CONTROL</div>
            <h1>Make AI work.<br /><span>Make it earn DONE.</span></h1>
            <p>
              Give an agent a real job. The control plane routes the work,
              enforces limits, recovers from failure, and requires evidence before success.
            </p>
            <div className="heroPills">
              <span>Policy gates</span>
              <span>Bounded repair</span>
              <span>Verification</span>
              <span>Decision ledger</span>
            </div>
            <div className="heroNote">
              <b>No proof → no DONE.</b>
              <span>Designed for autonomous work that still needs a defensible result.</span>
            </div>
          </div>

          <section className="agentConsole" aria-label="Agent task composer">
            <div className="consoleChrome">
              <span className="windowDot red" />
              <span className="windowDot amber" />
              <span className="windowDot green" />
              <strong>START A REAL JOB</strong>
              <span className="consoleStatus">{routerRunning || running ? "WORKING" : "READY"}</span>
            </div>
            <div className="consolePrompt">
              <span className="consoleLabel">TASK</span>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                aria-label="Engineering task"
              />
              <div className="taskExamples">
                <span>TRY A REAL JOB</span>
                <div>
                  {taskExamples.map((example, index) => (
                    <button type="button" key={index} onClick={() => setTask(example)}>
                      {index === 0 ? "Fix CI" : index === 1 ? "Review change" : index === 2 ? "Migrate model" : "Investigate incident"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="consoleControls">
              <div className="limitGroup">
                <span>LIMITS</span>
                <button type="button" onClick={() => setMaxCost(0.05)}>$0.05 cap</button>
                <button type="button" onClick={() => setMaxIterations(3)}>3 repair loops</button>
                <button type="button">Verification required</button>
              </div>
              <div className="consoleActions">
                <button className="secondaryAction" onClick={runLiveRouter} disabled={routerRunning || !task.trim()}>
                  {routerRunning ? "Comparing…" : "See route"}
                </button>
                <button className="workspaceAction" onClick={openWorkspace} disabled={!task.trim()}>
                  Open run ↗
                </button>
                <button className="primaryAction" onClick={run} disabled={running || !task.trim()}>
                  {running ? "Executing…" : "Run task →"}
                </button>
              </div>
            </div>
            <div className="consoleHint">
              "Live runtime. The primary path never silently substitutes a simulated result."
            </div>
          </section>
        </section>

        <section className="signalBar" aria-label="Product capabilities">
          <div><strong>CONTROL</strong><span>What the agent is allowed to do</span></div>
          <div><strong>ROUTING</strong><span>Which path is worth taking</span></div>
          <div><strong>RECOVERY</strong><span>What happens when work fails</span></div>
          <div><strong>PROOF</strong><span>Why the system is allowed to say DONE</span></div>
        </section>

        <section className="workSection" id="work">
          <div className="sectionIntro">
            <div>
              <span className="sectionTag">REAL WORK, NOT CHAT</span>
              <h2>Give it the kind of task you would normally keep an engineer around for.</h2>
            </div>
            <p>Examples of the real workloads the control plane is designed to execute, recover, and verify.</p>
          </div>

          <div className="workGrid">
            <article className="workCard featured">
              <div className="workTop">
                <span>ENGINEERING</span>
                <span>VERIFY + REPAIR</span>
              </div>
              <h3>Fix a failing CI pipeline</h3>
              <p>Find the root cause, make the smallest change, run the checks again, and stop when the evidence is conclusive.</p>
              <div className="workMeta"><span>2–3 bounded attempts</span><span>Tests required</span></div>
            </article>
            <article className="workCard">
              <div className="workTop"><span>CHANGE REVIEW</span><span>RISK GATE</span></div>
              <h3>Review a risky code change</h3>
              <p>Inspect the requested change, check policy boundaries, surface evidence, and escalate when the proof is incomplete.</p>
              <div className="workMeta"><span>Evidence ledger</span><span>Human review path</span></div>
            </article>
            <article className="workCard">
              <div className="workTop"><span>MIGRATION</span><span>LONGER RUN</span></div>
              <h3>Execute a production migration</h3>
              <p>Route subtasks, enforce execution limits, verify checkpoints, and leave a replayable record of the decision.</p>
              <div className="workMeta"><span>Bounded cost</span><span>Replayable</span></div>
            </article>
          </div>
        </section>

        {!result ? (
          <section className="proofShowcase" id="proof">
            <div className="showcaseIntro">
              <span className="sectionTag">THE INTERESTING PART</span>
              <h2>AI output is easy to generate. A defensible decision is not.</h2>
              <p>
                The runtime is designed around the last question a CTO actually asks:
                <strong> “What makes you believe this worked?”</strong>
              </p>
            </div>

            <div className="executionMock">
              <div className="mockHeader">
                <div>
                  <span>ILLUSTRATIVE EXECUTION</span>
                  <strong>Fix failing CI</strong>
                </div>
                <span className="mockState">VERIFIED</span>
              </div>
              <div className="mockBody">
                <div className="mockSteps">
                  <div className="mockStep"><b>01</b><span>Investigate failure</span><i>✓</i></div>
                  <div className="mockStep"><b>02</b><span>Apply smallest fix</span><i>✓</i></div>
                  <div className="mockStep failed"><b>03</b><span>Verification failed</span><i>×</i></div>
                  <div className="mockStep repair"><b>04</b><span>Bounded repair</span><i>↻</i></div>
                  <div className="mockStep"><b>05</b><span>Verification passed</span><i>✓</i></div>
                </div>
                <div className="mockProof">
                  <div><span>FINAL DECISION</span><strong>VERIFIED</strong></div>
                  <div><span>CHECKS</span><b>3 passed</b></div>
                  <div><span>ATTEMPTS</span><b>2</b></div>
                  <div><span>RECORD</span><b>attached</b></div>
                </div>
              </div>
              <div className="mockFooter">No proof → no DONE.</div>
            </div>
          </section>
        ) : (
          <section className="receiptSection" id="proof">
            <div className="receiptHeader">
              <div>
                <span className="sectionTag">EXECUTION RECEIPT</span>
                <h2>{verified ? "Verified outcome." : "Not verified."}</h2>
                <p>{result.task ?? task}</p>
              </div>
              <span className={verified ? "receiptState good" : "receiptState bad"}>
                {verified ? "VERIFIED" : "STOPPED"}
              </span>
            </div>

            <div className="receiptMetrics">
              <div><span>TIME TO DECISION</span><strong>{latency != null ? `${(latency / 1000).toFixed(2)}s` : "—"}</strong></div>
              <div><span>COST</span><strong>{cost != null ? `$${cost.toFixed(3)}` : "—"}</strong></div>
              <div><span>QUALITY</span><strong>{quality != null ? `${Math.round(quality * 100)}%` : "—"}</strong></div>
              <div><span>ITERATIONS</span><strong>{result.iteration ?? "—"}</strong></div>
            </div>

            <div className="receiptGrid">
              <div className="receiptPanel">
                <div className="panelTitle">EXECUTION</div>
                <div className="receiptTimeline">
                  {stageOrder.map((stage) => {
                    const candidates = trajectory.filter((item) => stage.aliases.some((alias) => item.step === alias));
                    const item = stage.preferLast ? candidates[candidates.length - 1] : candidates[0];
                    return (
                      <div className={`receiptStage ${item?.status ?? "pending"}`} key={stage.key}>
                        <span>{statusIcon(item?.status ?? "pending")}</span>
                        <div><strong>{stage.label}</strong><small>{item?.detail ?? "Waiting"}</small></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="receiptPanel">
                <div className="panelTitle">WHY THIS CAN BE TRUSTED</div>
                <div className="proofSummary">
                  <div className="proofBig">{result.verification?.checks?.length ?? evidence.length}</div>
                  <div><strong>verification gates</strong><span>must pass before VERIFIED</span></div>
                </div>
                <div className="evidenceList">
                  {evidence.map((item, index) => (
                    <div className="evidenceItem" key={`${item.claim}-${index}`}>
                      <span>{item.status === "verified" ? "✓" : "×"}</span>
                      <div><strong>{item.claim}</strong><small>{item.evidence}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <details className="deepDive">
              <summary>See the decision ledger and runtime detail</summary>
              <div className="deepDiveGrid">
                <div><span>ACTION</span><strong>{result.decision?.action ?? "—"}</strong></div>
                <div><span>POLICY</span><strong>{result.decision?.policy_action ?? "—"}</strong></div>
                <div><span>RISK</span><strong>{result.decision?.risk ?? "—"}</strong></div>
                <div><span>REASON</span><strong>{result.decision?.reason_code ?? "—"}</strong></div>
              </div>
              <p>{result.decision?.reason ?? result.output ?? "No decision reason returned."}</p>
              <pre>{result.output}</pre>
            </details>

            <div className="receiptFooter">
              <span>RUN ID {result.run_id ?? "RUN"}</span>
              <button className="secondaryAction" onClick={() => setResult(null)}>Run another task</button>
            </div>
          </section>
        )}

        {(routerRunning || routerCards.length > 0 || selectedRoute) && (
          <section className="routerSection">
            <div className="sectionIntro compact">
              <div>
                <span className="sectionTag">UNDER THE HOOD</span>
                <h2>Routing is a decision, not the product.</h2>
              </div>
              <p>When a live comparison is useful, the runtime can probe configured routes in parallel and select from measured results.</p>
            </div>

            <div className="routerBoard">
              {routerCards.map((card) => (
                <div className={`routerProductCard ${card.status} ${selectedRoute?.provider === card.provider ? "winner" : ""}`} key={card.provider}>
                  <div className="routerProductTop">
                    <strong>{card.label}</strong>
                    <span>
                      {card.status === "running"
                        ? "WORKING"
                        : card.status === "failed"
                        ? "FAILED"
                        : card.status === "not_configured"
                        ? "NOT CONFIGURED"
                        : selectedRoute?.provider === card.provider
                        ? "SELECTED"
                        : "DONE"}
                    </span>
                  </div>
                  <small>{card.model}</small>
                  {card.status === "not_configured" ? (
                    <div className="routerDiagnostic muted">No credential configured for this provider.</div>
                  ) : card.status === "failed" ? (
                    <div className="routerDiagnostic error">
                      <strong>{card.statusCode ? `HTTP ${card.statusCode}` : "Provider error"}</strong>
                      <span>{card.error ?? card.preview ?? "Provider call failed."}</span>
                    </div>
                  ) : (
                    <>
                      <div className="routerProductBar"><i style={{ width: `${Math.max(8, Math.min(100, (card.score ?? 0) * 100))}%` }} /></div>
                      <div className="routerProductStats"><span>{card.latencyMs ? `${card.latencyMs}ms` : "—"}</span><span>{card.costUsd != null ? `$${card.costUsd.toFixed(4)}` : "—"}</span><span>{card.quality ? `${Math.round(card.quality * 100)}%` : "—"}</span></div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {parallelProof && (
              <div className="routerProof">
                <span>PARALLEL PROOF</span>
                <strong>{parallelProof.configuredProviders}/{parallelProof.expectedProviders} configured · {parallelProof.maxConcurrent} concurrent</strong>
                <p>{parallelProof.proof} Wall clock {parallelProof.wallClockMs}ms.</p>
              </div>
            )}

            {selectedRoute && (
              <div className="routerDecision">
                <span>SELECTED ROUTE</span>
                <strong>{selectedRoute.label} / {selectedRoute.model}</strong>
                <p>Chosen using measured quality, latency and cost.</p>
              </div>
            )}

            {routerCards.some((card) => card.status === "complete" && card.output) && (
              <div className="routerOutput">
                <div className="routerOutputHeader">
                  <div>
                    <span>ALL PROVIDER OUTPUTS</span>
                    <strong>Compare what each model actually returned</strong>
                  </div>
                  <span>{routerCards.filter((card) => card.status === "complete").length} RESPONSES</span>
                </div>
                <div className="providerOutputs">
                  {routerCards.filter((card) => card.status === "complete" && card.output).map((card) => (
                    <details className={`providerOutput ${selectedRoute?.provider === card.provider ? "selected" : ""}`} key={card.provider}>
                      <summary>
                        <strong>{card.label}</strong>
                        <span>{selectedRoute?.provider === card.provider ? "SELECTED" : "COMPARE"} · {card.quality ? `${Math.round(card.quality * 100)}%` : "—"} · {card.latencyMs ? `${card.latencyMs}ms` : "—"}</span>
                      </summary>
                      <pre>{card.output}</pre>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {routerCards.some((card) => card.status === "failed") && (
              <div className="routerDiagnostics">
                <div className="routerOutputHeader">
                  <div>
                    <span>PROVIDER DIAGNOSTICS</span>
                    <strong>Why some routes failed</strong>
                  </div>
                </div>
                {routerCards.filter((card) => card.status === "failed").map((card) => (
                  <div className="diagnosticRow" key={card.provider}>
                    <strong>{card.label}</strong>
                    <span>{card.statusCode ? `HTTP ${card.statusCode}` : "ERROR"}</span>
                    <p>{card.error ?? card.preview ?? "Unknown provider failure."}</p>
                  </div>
                ))}
              </div>
            )}

          </section>
        )}

        <section className="principlesSection">
          <div className="sectionIntro compact">
            <div>
              <span className="sectionTag">WHAT THE SYSTEM CONTROLS</span>
              <h2>Built around the boundaries that matter when AI can take action.</h2>
            </div>
          </div>
          <div className="principleGrid">
            <article><span>01</span><h3>Policy before action</h3><p>Identity, permissions, risk and execution limits are evaluated before tools are allowed to run.</p></article>
            <article><span>02</span><h3>Failure is a state</h3><p>A failed verification produces a bounded repair path instead of an unlimited retry loop.</p></article>
            <article><span>03</span><h3>Evidence before success</h3><p>The runtime records checks, evidence and a decision reason before it can produce VERIFIED.</p></article>
            <article><span>04</span><h3>Replayable decisions</h3><p>Important execution choices leave a ledger that can be inspected and evaluated later.</p></article>
          </div>
        </section>

        <section className="architectureSection" id="architecture">
          <details>
            <summary><span>Architecture</span><strong>Open the control path →</strong></summary>
            <div className="architecturePath">
              <span>AGENT</span><i>→</i><span>IDENTITY</span><i>→</i><span>POLICY + RISK</span><i>→</i><span>ALLOW / REVIEW / BLOCK</span><i>→</i><span>ROUTE + TOOLS</span><i>→</i><span>VERIFY</span><i>→</i><span>PROOF + LEDGER</span><i>→</i><span>EVAL / REPLAY</span>
            </div>
          </details>
        </section>

        {error && (
          <div className="productError">
            <strong>Run failed</strong>
            <span>{error}</span>
          </div>
        )}
      </main>
    </div>
  );

}
