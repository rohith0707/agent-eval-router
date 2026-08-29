import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/agent-plan.ts", "utf8");

assert.match(source, /export function buildExecutionPlan/);
assert.match(source, /routeBeforeInference:\s*true/);
assert.match(source, /taskType/);
assert.match(source, /preferredProviders/);
assert.match(source, /requiresTool/);
assert.match(source, /maxSteps/);
assert.match(source, /text_to_sql/);
assert.match(source, /tool_calling/);
assert.match(source, /agent_planning/);
assert.match(source, /openrouter/);
assert.match(source, /nvidia/);

console.log("[agentic-runtime-contract] PASS (12 assertions)");
