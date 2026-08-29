# Production Benchmark Execution

The repository's 50-case suite is an execution input. Performance claims must come from real provider runs.

The production evidence workflow calls the deployed `/api/benchmark` endpoint, validates that all 50 cases were evaluated, prints measured summary metrics, and uploads the raw JSON response as a short-lived GitHub Actions artifact.

## Metrics

The benchmark response reports task success/quality, P95 latency, fallback rate, provider mix, per-category outcomes, and failure evidence. Cost should only be reported from provider token/cost data captured by the execution path.

## Interpretation

Do not compare strategies from different datasets or partial runs. Keep the full 50-case suite fixed when comparing models or routing policies. Treat infrastructure failures separately from evaluated quality failures.
