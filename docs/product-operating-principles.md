# Product Operating Principles

These principles define how Agent Eval Router should be built and demonstrated.

## 1. The product is the execution layer

Users do not come to the product to watch models talk. They give the system a job.

The product turns:

Task -> Policy -> Route -> Execute -> Verify -> Evidence -> Outcome

Model selection, provider comparison, multi-agent workers, and routing algorithms are implementation details that support this loop.

## 2. AI is the worker; the runtime is the product

The model supplies capability.

The runtime supplies:
- permissions and boundaries;
- task and risk classification;
- model/tool routing;
- budget and time limits;
- bounded recovery;
- verification;
- evidence;
- decision records;
- human escalation.

The product should remain useful even when the underlying model changes.

## 3. Show real work, not model theater

The primary demo must start from a recognizable workload:
- fix a failing CI task;
- review a risky change;
- investigate a production error;
- migrate a model or integration.

The main CTA should run the live path.

Simulation may exist for tests, local development, or a controlled demo route, but production UI must never silently replace a failed live run with simulated output.

## 4. Outcome first, machinery second

The first screen after execution should answer:
1. What was requested?
2. What was produced?
3. What was verified?
4. What decision was made?

Provider/model diagnostics belong behind the outcome, not in front of it.

## 5. No proof -> no DONE

An agent's prose is a claim, not proof.

Completion requires task-appropriate verification evidence. For engineering work this should progressively include real artifacts such as diffs, test output, build output, and repository state.

For high-risk actions the system must support escalation or blocking.

## 6. Bounded autonomy

Autonomy grows only inside explicit boundaries:
- filesystem scope;
- network scope;
- tool permissions;
- cost;
- wall-clock time;
- iteration count;
- failure count;
- risk policy.

A retry loop is a controlled state machine, not an invitation to keep trying forever.

## 7. Make the environment legible to the agent

The agent performs better when the task environment exposes the right context and feedback:
- repository instructions;
- tests;
- logs;
- metrics;
- diffs;
- execution traces;
- clear acceptance criteria.

Missing capability should be treated as an engineering problem in the runtime, not solved by making the prompt longer.

## 8. Evidence must be attributable

Every important runtime decision should have:
- run ID;
- decision ID;
- policy version;
- selected strategy;
- alternatives when applicable;
- actual latency/cost;
- tool actions;
- verification outcome;
- final state.

Never manufacture benchmark, cost, quality, latency, or production claims.

## 9. Use multiple models for resilience and economics

Multiple providers are valuable when they improve:
- success rate;
- reliability;
- latency;
- cost;
- capability coverage;
- recovery options.

Provider count is not a product metric by itself.

## 10. Build one spectacular workflow before expanding scope

The first complete real workflow should be:

Issue/task
-> investigate
-> execute inside a bounded environment
-> produce an artifact
-> run verification
-> recover from failure when permitted
-> produce evidence
-> return a reviewable result

The benchmark and UI should measure this workflow end to end.

## 11. Human attention is the scarce resource

The system should reduce unnecessary supervision while keeping meaningful control points.

Low-risk work can proceed automatically inside bounds.

Higher-risk actions should become explicit:
- review;
- approval;
- escalation;
- block.

## 12. Product language

Prefer:
- Run a task
- Investigate
- Execute
- Verify
- Recover
- Review
- Evidence
- Ready for review
- Verified
- Escalated
- Blocked

Avoid leading with:
- multi-agent swarm;
- four-model router;
- AI demo;
- benchmark theater;
- internal architecture jargon.

## 13. North-star product statement

AI can do the work.

Agent Eval Router makes the work:
- bounded;
- observable;
- recoverable;
- verifiable;
- reviewable.

The system earns the right to say DONE.
