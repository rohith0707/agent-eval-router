import assert from "node:assert/strict";
import { TOTAL_EXPERIMENT_CASES, MAX_EXPERIMENT_BATCH_SIZE, normalizeExperimentBatch } from "../lib/experiment-batching.js";

assert.equal(TOTAL_EXPERIMENT_CASES, 50);
assert.equal(MAX_EXPERIMENT_BATCH_SIZE, 10);

assert.deepEqual(normalizeExperimentBatch(0, 10), { start: 0, limit: 10 });
assert.deepEqual(normalizeExperimentBatch(40, 10), { start: 40, limit: 10 });
assert.deepEqual(normalizeExperimentBatch(49, 10), { start: 40, limit: 10 });
assert.throws(() => normalizeExperimentBatch(-1, 10));
assert.throws(() => normalizeExperimentBatch(0, 11));
assert.throws(() => normalizeExperimentBatch(50, 10));

console.log("[experiment-batching] PASS (7 assertions)");
