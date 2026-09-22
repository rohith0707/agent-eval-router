# Security model

## Trust boundaries

Model output and retrieved/tool output are untrusted data. They are not authorization to execute an action.

## Required checks

1. Policy decision before privileged execution.
2. Explicit capability/scope for tools.
3. Server-side budget and timeout enforcement.
4. No destructive operation under read-only policy.
5. Authentication/authorization before sensitive actions.
6. Minimize sensitive data in model prompts and final responses.
7. Record security-relevant decisions in the ledger.

## Threat cases

The test suite should cover prompt injection, malicious retrieved instructions, tool abuse, unauthorized data export, destructive SQL, malformed model output, budget bypass, retry storms, and provider/tool timeouts.

## Production path

Add secret isolation, outbound allowlists, per-tool credentials, tenant isolation, audit retention policy, encryption at rest/in transit, and security-event alerting before exposing privileged tools to real users.


## Agent action authorization

The live agent path requires an explicit authorization context before execution: actor_id -> principal_id -> actual tool -> actual action -> parameters/resource -> policy -> expiry.

Entitlements are server-side (AGENT_AUTHORIZATION_POLICY_JSON) and are never accepted from the agent request. The enforcement point derives the actual tool (bounded_http or model.generate) from the runtime plan, checks the delegated principal, parameter limits, resource scope and a maximum 15-minute TTL, then fails closed with BLOCK on denial.

Every authorization result is persisted in the Decision Ledger, including actor, principal, tool/action, policy version, expiry, TTL, parameters and the denial reason. This is an application-level policy enforcement point; production deployments still need authenticated identity/delegation evidence, signed credentials, revocation, and a trusted identity provider.
