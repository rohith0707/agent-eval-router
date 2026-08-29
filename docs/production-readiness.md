# Production-readiness verification

## Required evidence before calling the system production-ready

1. A deployed evaluation can complete end-to-end with a real configured provider.
2. The same run is persisted and visible through Overview, Routing Intelligence, and Trace Explorer.
3. Provider failures are bounded by timeout/retry/fallback policy.
4. Token, latency, cost, quality, failure, and fallback evidence are captured without secrets.
5. The fixed 50-case benchmark produces real measurements before any improvement claim is made.
6. The regression gate rejects a deliberately degraded result.
7. Security guardrails reject oversized/untrusted inputs and redact sensitive evidence.

A green code/build check alone is insufficient; production readiness requires successful execution evidence.
