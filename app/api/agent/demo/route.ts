import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const task = typeof body.task === "string" && body.task.trim() ? body.task.trim() : "Fix the failing CI import in the agent runtime, verify the fix, and stop only when verification passes.";

  return NextResponse.json({
    provenance: "SIMULATED_DEMO",
    run_id: `demo-${Date.now()}`,
    status: "done",
    loop_action: "COMPLETE",
    iteration: 2,
    task,
    agents: [
      { role: "Planner", status: "complete", detail: "Decomposed the task into investigation, implementation, testing, review and verification." },
      { role: "Investigator", status: "complete", detail: "Located the failing import and identified the source-of-truth module." },
      { role: "Implementer", status: "complete", detail: "Applied the minimal corrective patch." },
      { role: "Tester", status: "failed", detail: "Simulated test failure triggered a repair loop." },
      { role: "Repairer", status: "complete", detail: "Addressed the failed verification and regenerated the patch." },
      { role: "Reviewer", status: "complete", detail: "Attempted to disprove the repair; no remaining defect found." },
      { role: "Verifier", status: "passed", detail: "All required verification gates passed." },
    ],
    trajectory: [
      { step: "planner", status: "complete", detail: "Task decomposed", iteration: 1 },
      { step: "investigator", status: "complete", detail: "Root cause identified with evidence", iteration: 1 },
      { step: "implementer", status: "complete", detail: "Minimal patch prepared", iteration: 1 },
      { step: "tester", status: "failed", detail: "Simulated regression detected", iteration: 1 },
      { step: "repairer", status: "complete", detail: "Repair applied", iteration: 2 },
      { step: "reviewer", status: "complete", detail: "Review found no blocking issue", iteration: 2 },
      { step: "verifier", status: "passed", detail: "pytest + typecheck + build gates passed", iteration: 2 },
      { step: "loop", status: "complete", detail: "Verified autonomy boundary reached", iteration: 2 },
    ],
    decision: {
      action: "REPAIR",
      policy_action: "ALLOW",
      reason_code: "VERIFICATION_FAILED_THEN_REPAIRED",
      reason: "The first attempt failed verification, so the bounded runtime entered one repair iteration before allowing completion.",
      risk: "medium",
      evidence_count: 5,
      estimated_cost_usd: 0.018,
      provenance: "SIMULATED_DEMO",
    },
    verification: {
      passed: true,
      quality: 0.94,
      checks: ["root_cause_evidence", "patch_present", "tests_passed", "review_passed", "build_passed"],
      provenance: "SIMULATED_DEMO",
    },
    evidence: [
      { claim: "Root cause identified", evidence: "Failing import points to the wrong module boundary.", status: "verified" },
      { claim: "Repair applied", evidence: "Minimal import correction represented in the simulated diff.", status: "verified" },
      { claim: "Tests pass", evidence: "Simulated pytest gate passed after repair.", status: "verified" },
      { claim: "Completion is justified", evidence: "Reviewer and verifier gates passed.", status: "verified" },
    ],
    limits: { max_cost_usd: 0.05, max_iterations: 3, max_failures: 2 },
    total_cost_usd: 0.018,
    latency_ms: 1840,
    output: "SIMULATED DEMO — The bounded multi-agent workflow repaired the failing CI import and reached VERIFIED only after the repair, review and verification gates passed.",
  });
}
