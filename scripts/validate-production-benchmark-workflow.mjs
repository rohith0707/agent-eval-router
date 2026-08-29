import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/benchmark-production.yml", "utf8");

assert.match(workflow, /POST .*\/api\/benchmark/s);
assert.match(workflow, /start=\$\{start\}&limit=5/);
assert.match(workflow, /for start in 0 5 10 15 20 25 30 35 40 45/);
assert.match(workflow, /Expected 10 benchmark batches/);
assert.match(workflow, /Expected 50 accounted cases/);
assert.match(workflow, /Expected 50 unique case IDs/);
assert.match(workflow, /Expected 50 evaluated cases/);
assert.match(workflow, /upload-artifact@v4/);

const baseUrlMatch = workflow.match(/BASE_URL:\s*(https:\/\/[^\s]+)\s*/);
assert.ok(baseUrlMatch, "Workflow must define an HTTPS BASE_URL");
const baseUrl = baseUrlMatch[1].replace(/["']+$/g, "");
assert.match(baseUrl, /^https:\/\//);
assert.match(baseUrl, /(?:vercel\.app|vercel\.sh)$/);
assert.doesNotMatch(baseUrl, /\s/);

console.log(`[production-benchmark-workflow] PASS (14 assertions) target=${baseUrl} batches=10 size=5`);
