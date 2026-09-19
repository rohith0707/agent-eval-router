import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cases = JSON.parse(readFileSync("benchmarks/routing-bench-v1.json", "utf8"));
const categories = new Set(cases.map(c => c.category));

assert.ok(cases.length >= 15, "benchmark must contain at least 15 cases");
for (const category of ["reasoning", "tool_calling", "agent_planning", "reliability", "safety", "regression"]) {
  assert.ok(categories.has(category), `missing required category: ${category}`);
}
for (const c of cases) {
  assert.ok(c.id && c.category && c.task && c.expected_behavior, "every case needs an auditable contract");
}
assert.equal(new Set(cases.map(c => c.id)).size, cases.length, "benchmark case IDs must be unique");

console.log(`[production-benchmark-contract] PASS (${cases.length} cases, ${categories.size} categories)`);
