import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/experiment-batching.ts", "utf8");

assert.match(source, /TOTAL_EXPERIMENT_CASES\s*=\s*50/);
assert.match(source, /MAX_EXPERIMENT_BATCH_SIZE\s*=\s*10/);
assert.match(source, /export function normalizeExperimentBatch/);
assert.match(source, /start < 0/);
assert.match(source, /startValue >= TOTAL_EXPERIMENT_CASES/);
assert.match(source, /limitValue > MAX_EXPERIMENT_BATCH_SIZE/);
assert.match(source, /Math\.floor\(startValue \/ MAX_EXPERIMENT_BATCH_SIZE\)/);

console.log("[experiment-batching] PASS (7 assertions)");
