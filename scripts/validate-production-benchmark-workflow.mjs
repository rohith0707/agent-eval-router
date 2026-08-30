import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/benchmark-production.yml", "utf8");

assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /deployment_status:/);
assert.doesNotMatch(workflow, /github\.event\.deployment_status/);
assert.match(workflow, /PRODUCTION_BENCHMARK_BASE_URL/);
assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
assert.match(workflow, /POST .*\/api\/benchmark/s);
assert.match(workflow, /start=\$\{start\}&limit=5/);
assert.match(workflow, /for start in 0 5 10 15 20 25 30 35 40 45/);
assert.match(workflow, /Expected 10 benchmark batches/);
assert.match(workflow, /Expected 50 accounted cases/);
assert.match(workflow, /Expected 50 unique case IDs/);
assert.match(workflow, /Expected 50 evaluated cases/);
assert.match(workflow, /api\/meta/);
assert.match(workflow, /upload-artifact@v4/);

assert.doesNotMatch(workflow, /BASE_URL:\s*https:\/\/agent-eval-router-balsarohith5-5561s-projects\.vercel\.app/);

console.log("[production-benchmark-workflow] PASS (15 assertions) manual-only trigger + 10 batches + deployment fingerprint");
