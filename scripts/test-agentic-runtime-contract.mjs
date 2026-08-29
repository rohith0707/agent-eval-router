import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/agent-plan.ts", "utf8");

assert.match(source, /export function buildExecutionPlan/);
const planInitializer = source.match(/const plan:[\s\S]*?= \{([\s\S]*?)\n  \};/);
assert.ok(planInitializer, "Planner must define a concrete execution plan initializer");
assert.match(planInitializer[1], /routeBeforeInference:\s*true/);
assert.match(planInitializer[1], /preferredProviders:/);
assert.match(planInitializer[1], /requiresTool:/);
assert.match(planInitializer[1], /maxSteps:/);
assert.match(source, /text_to_sql/);
assert.match(source, /tool_calling/);
assert.match(source, /agent_planning/);
assert.match(source, /openrouter/);
assert.match(source, /nvidia/);
assert.match(source, /return plan;/);

console.log("[agentic-runtime-contract] PASS (12 assertions)");
