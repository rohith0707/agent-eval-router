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
