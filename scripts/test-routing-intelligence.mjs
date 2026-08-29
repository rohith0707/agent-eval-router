import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const experiment = readFileSync(new URL("../lib/experiment.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/experiment/route.ts", import.meta.url), "utf8");

assert.match(experiment, /adaptiveCandidates\(category\)/);
assert.match(experiment, /rationale = `Adaptive policy:/);
assert.match(experiment, /for \(const candidate of candidates\)/);
assert.match(experiment, /callProvider\(candidate\.provider, candidate\.model/);
assert.match(experiment, /attempts\.push/);
assert.match(experiment, /fallbacks: Math\.max\(0, execution\.attempts\.length - 1\)/);
assert.match(route, /adaptiveVsBaseline/);
assert.match(route, /adaptiveVsCheapest/);
assert.match(route, /qualityDelta/);
assert.match(route, /latencyDelta/);
assert.match(route, /costPerSuccessfulTaskDelta/);

console.log("Routing Intelligence contract tests: PASS (11 assertions)");
