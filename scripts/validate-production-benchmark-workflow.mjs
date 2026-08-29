import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/benchmark-production.yml", "utf8");

assert.match(workflow, /POST .*\/api\/benchmark/s);
assert.match(workflow, /Expected 50 cases/);
assert.match(workflow, /Expected 50 evaluated cases/);
assert.match(workflow, /upload-artifact@v4/);

const baseUrlMatch = workflow.match(/BASE_URL:\s*(https:\/\/[^\s]+)\s*/);
assert.ok(baseUrlMatch, "Workflow must define an HTTPS BASE_URL");
const baseUrl = baseUrlMatch[1].replace(/["']+$/g, "");
assert.match(baseUrl, /^https:\/\//);
assert.match(baseUrl, /(?:vercel\.app|vercel\.sh)$/);
assert.doesNotMatch(baseUrl, /\s/);

console.log(`[production-benchmark-workflow] PASS (8 assertions) target=${baseUrl}`);
