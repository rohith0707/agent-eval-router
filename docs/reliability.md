# Reliability

## Hard invariants

- Maximum cost is enforced server-side.
- Maximum iterations are enforced server-side.
- Maximum wall-clock time is enforced server-side.
- Maximum failures are bounded.
- Provider failures can trigger bounded fallback.
- Verification failure can trigger bounded repair.
- Replay is non-destructive and does not execute external actions.

## Failure taxonomy

Provider failures, tool failures, policy blocks, quality failures, malformed output, timeouts, rate limits, and budget exhaustion are recorded separately where possible.

## Idempotency and production hardening

The current runtime is a portfolio implementation. A production deployment should add an idempotency key per external action, durable queue state, lease/heartbeat handling, cancellation propagation, retry budgets per dependency, and exactly-once-or-compensating semantics for side effects.
