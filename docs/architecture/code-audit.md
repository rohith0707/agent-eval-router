# Senior Architecture Code Audit

## Invariants

- Preserve the external API shapes of `/api/evaluate`, `/api/live-evaluate`, `/api/benchmark`, `/api/health`, and `/api/runs`.
- Preserve provider priority: Gemini -> Hugging Face -> NVIDIA -> OpenRouter.
- Preserve online serving as first-success cascading fallback.
- Preserve benchmark execution as bounded and concurrency-limited.
- Never expose raw provider errors or credentials to clients.
- Dashboard metrics must come from persisted evidence or explicit benchmark output.

## Main findings

1. Provider configuration and model registry are concentrated in `lib/providers.ts`; request handlers should not duplicate provider/model policy.
2. `lib/engine.ts` contains legacy static candidate metrics. This is useful for the preview routing API but must not be treated as live model telemetry.
3. Provider transport code should use typed JSON envelopes instead of `any` and should centralize endpoint/header construction.
4. Benchmark execution should consume a bundled typed data module rather than filesystem access inside a serverless request.
5. Database persistence failures should degrade gracefully after inference succeeds; inference should not depend on persistence.
6. CI must run typecheck, benchmark validation, and production build before a deployment can be considered releasable.

## Optimization principles

- Avoid rebuilding provider configuration on every request where it can be safely represented as immutable constants.
- Avoid duplicate HTTP request construction across providers.
- Keep timeouts explicit and bounded.
- Keep serialized traces compact.
- Avoid `any` in application code where the response schema is known.
- Use small pure functions for classification, routing, validation, and scoring so unit tests remain cheap.
