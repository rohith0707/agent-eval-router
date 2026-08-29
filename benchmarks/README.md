# Benchmark Evidence

`routing-bench-v1.jsonl` contains 50 original, project-owned benchmark cases across 10 categories. The suite is an execution input, not a source of precomputed performance claims.

## Evidence contract

A real benchmark run must record, for every case:

- `caseId`
- `category`
- `model`
- `passed`
- `latencyMs`
- `costUsd`
- `fallback`

Aggregate results with `summarizeBenchmark` in `lib/benchmark-evidence.ts` and feed the resulting measurements into the existing regression gate.

Do not commit synthetic or manually edited performance results. Provider/model comparisons must come from actual executions and retain enough raw evidence to reproduce the aggregate metrics.

## CI

- `npm run validate:benchmark` validates the 50-case definition.
- `npm run validate:benchmark-evidence` validates the benchmark evidence input contract.
- `npm run test:benchmark-evidence` verifies metric aggregation.
- `npm test` includes the benchmark evidence unit test.
