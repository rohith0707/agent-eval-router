import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/experiment-batching.ts", "utf8");

assert.match(source, /TOTAL_EXPERIMENT_CASES\s*=\s*50/);
assert.match(source, /MAX_EXPERIMENT_BATCH_SIZE\s*=\s*10/);
assert.match(source, /export function normalizeExperimentBatch/);
assert.match(source, /startValue\s*<\s*0/);
assert.match(source, /startValue\s*>=\s*TOTAL_EXPERIMENT_CASES/);
assert.match(source, /limitValue\s*<=\s*0/);
assert.match(source, /limitValue\s*>\s*MAX_EXPERIMENT_BATCH_SIZE/);
assert.match(source, /Math\.floor\(startValue \/ MAX_EXPERIMENT_BATCH_SIZE\)/);
assert.match(source, /Math\.min\(limitValue, remaining\)/);

console.log("[experiment-batching] PASS (9 assertions)");
