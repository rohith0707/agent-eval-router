import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = process.cwd();
const route = readFileSync(`${root}/app/api/benchmark/route.ts`, "utf8");
const providers = readFileSync(`${root}/lib/providers.ts`, "utf8");
const breaker = readFileSync(`${root}/lib/circuit-breaker.ts`, "utf8");

assert.match(route, /BENCHMARK_ATTEMPT_TIMEOUT_MS = 7000/);
assert.match(route, /BENCHMARK_CASE_DEADLINE_MS = 15000/);
assert.match(route, /BENCHMARK_CONCURRENCY = 2/);
assert.match(route, /BENCHMARK_MAX_MODELS_PER_PROVIDER = 3/);
assert.match(route, /respectCircuitBreaker: false/);
assert.match(providers, /respectCircuitBreaker\?: boolean/);
assert.match(providers, /const respectCircuitBreaker = options\.respectCircuitBreaker \?\? true/);
assert.match(providers, /if \(respectCircuitBreaker && isProviderTripped\(providerName\)\)/);
assert.match(breaker, /return statusCode === 402 \|\| statusCode === 429/);
assert.doesNotMatch(providers, /metadata\.statusCode === 429 \|\| metadata\.statusCode === 402 \|\| metadata\.statusCode === 401 \|\| metadata\.statusCode === 403/);

console.log("[benchmark-reliability-unit] PASS (10 assertions)");
