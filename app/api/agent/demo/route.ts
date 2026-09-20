import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Evidence = { claim: string; evidence: string; status: string };

function classifyTask(task: string) {
  const normalized = task.toLowerCase();
  if (/\b(what is|who is|why |how does|compare |explain |gpt|model|research|investigate|analy[sz]e)\b/.test(normalized)) {
    return "research";
  }
  if (/\b(build|design|architect|create|implement|develop)\b/.test(normalized)) {
    return "build";
  }
  if (/\b(fix|debug|bug|ci|test|compile|refactor|migration|deploy)\b/.test(normalized)) {
    return "engineering";
  }
  return "general";
}

function buildDemo(task: string) {
  const kind = classifyTask(task);

  if (kind === "research") {
    const checks = ["Task parsed", "Scope identified", "Deliverable structured", "Evidence boundary recorded"];
    const evidence: Evidence[] = [
      {
        claim: "Task scope identified",
        evidence: "The runtime classified this as a research/knowledge task and extracted the requested concepts and desired outcome.",
        status: "verified",
      },
      {
        claim: "Output format selected",
        evidence: "The run produced a structured research brief instead of an engineering patch artifact.",
        status: "verified",
      },
      {
        claim: "Factual boundary preserved",
        evidence: "The demo does not claim live external research was performed; current model facts require the live research path.",
        status: "verified",
      },
      {
        claim: "Completion decision justified",
        evidence: "All demo workflow gates passed and the result is explicitly marked as simulated.",
        status: "verified",
      },
    ];

    return {
      provenance: "SIMULATED_DEMO",
      run_id: "demo-" + Date.now(),
      status: "done",
      loop_action: "COMPLETE",
      iteration: 1,
      task,
      task_type: kind,
      deliverable: {
        type: "Research brief",
        title: "Structured answer plan",
        summary: "A research task should return a clear explanation, relevant capabilities or options, and evidence boundaries before claiming completion.",
        sections: [
          { title: "Task interpretation", body: 'Answer the user request: "' + task + '"' },
          {
            title: "Expected output",
            body: "A concise explanation, concrete use cases, and a clearly separated list of claims that require current-source verification.",
          },
          {
            title: "Live verification boundary",
            body: "This demo does not call external research sources. A live run should retrieve current documentation or source material before presenting time-sensitive model facts.",
          },
        ],
      },
      agents: [
        { role: "Planner", status: "complete", detail: "Converted the request into a research deliverable." },
        { role: "Investigator", status: "complete", detail: "Identified the concepts and evidence requirements." },
        { role: "Reviewer", status: "complete", detail: "Checked that unsupported current facts were not presented as verified." },
        { role: "Verifier", status: "passed", detail: "Output structure and evidence boundaries passed." },
      ],
      trajectory: [
        { step: "planner", status: "complete", detail: "Task scope parsed", iteration: 1 },
        { step: "investigator", status: "complete", detail: "Research deliverable defined", iteration: 1 },
        { step: "reviewer", status: "complete", detail: "Evidence boundary reviewed", iteration: 1 },
        { step: "verifier", status: "passed", detail: "Completion checks passed", iteration: 1 },
      ],
      decision: {
        action: "COMPLETE",
        policy_action: "ALLOW",
        reason_code: "STRUCTURED_OUTPUT_VERIFIED",
        reason: "The simulated research workflow produced the expected output shape and preserved the boundary between simulated execution and live factual verification.",
        risk: "low",
        evidence_count: evidence.length,
        estimated_cost_usd: 0.006,
        provenance: "SIMULATED_DEMO",
      },
      verification: {
        passed: true,
        quality: 0.91,
        checks,
        provenance: "SIMULATED_DEMO",
      },
      evidence,
      limits: { max_cost_usd: 0.05, max_iterations: 3, max_failures: 2 },
      total_cost_usd: 0.006,
      latency_ms: 920,
      output: "A structured research brief was prepared. Live mode should retrieve current sources before making time-sensitive factual claims.",
    };
  }

  const checks = ["Root cause found", "Patch represented", "Tests passed", "Completion verified"];
  const evidence: Evidence[] = [
    { claim: "Root cause identified", evidence: "The simulated run isolated the failure before proposing a change.", status: "verified" },
    { claim: "Change represented", evidence: "A minimal corrective artifact was prepared for the engineering task.", status: "verified" },
    { claim: "Verification passed", evidence: "Required verification gates passed after one bounded repair iteration.", status: "verified" },
    { claim: "Completion justified", evidence: "The final decision includes a recorded verification result.", status: "verified" },
  ];

  return {
    provenance: "SIMULATED_DEMO",
    run_id: "demo-" + Date.now(),
    status: "done",
    loop_action: "COMPLETE",
    iteration: 2,
    task,
    task_type: kind,
    deliverable: {
      type: "Engineering result",
      title: "Verified corrective change",
      summary: "The simulated workflow investigated the task, represented a bounded repair, and verified completion.",
      sections: [
        { title: "Root cause", body: "A blocking failure was isolated before modification." },
        { title: "Change", body: "A minimal corrective change was represented in the simulated artifact." },
        { title: "Verification", body: "The required checks passed after one bounded repair iteration." },
      ],
    },
    agents: [
      { role: "Planner", status: "complete", detail: "Decomposed the task into bounded work." },
      { role: "Investigator", status: "complete", detail: "Located the failure and supporting evidence." },
      { role: "Implementer", status: "complete", detail: "Prepared the smallest corrective change." },
      { role: "Tester", status: "failed", detail: "The first verification attempt failed and triggered a bounded repair." },
      { role: "Repairer", status: "complete", detail: "Applied the repair and reran the checks." },
      { role: "Verifier", status: "passed", detail: "All required verification gates passed." },
    ],
    trajectory: [
      { step: "planner", status: "complete", detail: "Task decomposed", iteration: 1 },
      { step: "investigator", status: "complete", detail: "Root cause identified", iteration: 1 },
      { step: "implementer", status: "complete", detail: "Minimal change prepared", iteration: 1 },
      { step: "tester", status: "failed", detail: "First verification failed", iteration: 1 },
      { step: "repairer", status: "complete", detail: "Repair applied", iteration: 2 },
      { step: "verifier", status: "passed", detail: "Verification gates passed", iteration: 2 },
    ],
    decision: {
      action: "REPAIR",
      policy_action: "ALLOW",
      reason_code: "VERIFICATION_FAILED_THEN_REPAIRED",
      reason: "The first verification attempt failed, so the bounded runtime entered one repair iteration before allowing completion.",
      risk: "medium",
      evidence_count: evidence.length,
      estimated_cost_usd: 0.018,
      provenance: "SIMULATED_DEMO",
    },
    verification: {
      passed: true,
      quality: 0.94,
      checks,
      provenance: "SIMULATED_DEMO",
    },
    evidence,
    limits: { max_cost_usd: 0.05, max_iterations: 3, max_failures: 2 },
    total_cost_usd: 0.018,
    latency_ms: 1840,
    output: "The simulated engineering workflow reached a verified result after one bounded repair iteration.",
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const task =
    typeof body.task === "string" && body.task.trim()
      ? body.task.trim()
      : "Fix the failing CI contract test in the agent runtime, verify the fix, and stop only when the pipeline passes.";

  return NextResponse.json(buildDemo(task));
}
