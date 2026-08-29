import assert from "node:assert/strict";
import { buildExecutionPlan } from "../lib/agent-plan.js";

const reasoning = buildExecutionPlan("Compare these two architectures and choose the safer design with explicit trade-offs.");
assert.equal(reasoning.taskType, "reasoning");
assert.ok(reasoning.preferredProviders.length > 0);
assert.equal(reasoning.routeBeforeInference, true);

const sql = buildExecutionPlan("Validate this SQL query and return a read-only summary for tenant_id=42.");
assert.equal(sql.taskType, "text_to_sql");
assert.equal(sql.routeBeforeInference, true);
assert.ok(sql.preferredProviders.includes("nvidia") || sql.preferredProviders.includes("openrouter"));

const tool = buildExecutionPlan("Use the weather tool to check Hyderabad temperature and explain the result.");
assert.equal(tool.taskType, "tool_calling");
assert.equal(tool.requiresTool, true);
assert.ok(tool.maxSteps >= 2);

const empty = buildExecutionPlan(" ");
assert.equal(empty.routeBeforeInference, true);
assert.equal(empty.requiresTool, false);

console.log("[agentic-runtime-contract] PASS (12 assertions)");
