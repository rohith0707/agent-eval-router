# Architecture

## Control-plane boundary

The product is a control plane for autonomous work, not a generic agent-swarm framework.

```
Intent
  -> Policy / Risk / Budget
  -> Evidence-backed Route
  -> Bounded Worker Execution
  -> Deterministic Verification
  -> Repair / Escalate / Abort
  -> Decision Ledger
```

## Worker contracts

A coding workflow uses bounded roles: Investigator, Implementer, Tester, Reviewer, Repairer, and Verifier. These roles are contracts over the execution state, not unconstrained agents. The control plane remains responsible for authorization, budgets, retries, and stop conditions.

The current runtime may execute several role stages using the configured model adapter. It must never imply that a role is an independently deployed model when it is not.

## Why this architecture

Unbounded agent-to-agent delegation increases cost, latency, attribution ambiguity, and failure surface. The product therefore makes autonomy explicit and bounded: every stage produces evidence, every continuation has a reason, and completion requires verification.

## Scale path

SQLite is the current portfolio/runtime persistence layer. At production scale, the ledger interface should move behind a repository abstraction backed by PostgreSQL, with queue-based execution, idempotency keys, distributed tracing, encrypted secrets, and policy/config versioning.
