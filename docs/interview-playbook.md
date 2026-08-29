# AgentEval Router — Interview Playbook

## Product
AgentEval Router is an evaluation-driven control plane for AI workflows. It measures task quality, reliability, latency, cost, routing decisions, and execution evidence so model and workflow changes can be compared and regression-tested.

## Five-minute demo
1. Open Product AI Lab.
2. Submit a realistic agent task.
3. Show the routing decision and rationale.
4. Show evaluation quality, latency, fallback behavior, and persistence.
5. Open the trace and explain each execution step.
6. Show how benchmark evidence feeds a regression gate.

## Core questions to answer
- Why route instead of calling one model?
- How is model quality measured?
- How do you distinguish model failure from infrastructure failure?
- What happens on timeout/429/5xx?
- Why is bounded retry important?
- How do cost and latency constraints influence routing?
- How does a production failure become a regression case?
- What evidence is required before claiming an improvement?
- What information belongs in a trace?
- Which guarantees are deterministic and which require semantic evaluation?

## Engineering principles
- Evidence before optimization.
- No synthetic performance claims.
- Bounded retries and bounded execution budgets.
- Secrets remain server-side.
- Evaluation failures are explainable and categorized.
- Production changes should pass regression gates before release.
