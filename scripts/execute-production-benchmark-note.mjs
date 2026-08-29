import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/benchmark-production.yml", "utf8");

assert.match(workflow, /deployment_status:/);
assert.match(workflow, /github\.event\.deployment_status\.target_url/);
assert.match(workflow, /MANUAL_BASE_URL/);
assert.match(workflow, /BASE_URL=\"\$\{EVENT_TARGET_URL:-\$\{MANUAL_BASE_URL:-\}\}\"/);
assert.match(workflow, /https:\/\/\*\.vercel\.app\|https:\/\/\*\.vercel\.sh/);

assert.match(workflow, /POST .*\/api\/benchmark/s);
assert.match(workflow, /start=\$\{start\}&limit=5/);
assert.match(workflow, /for start in 0 5 10 15 20 25 30 35 40 45/);

console.log("[benchmark-production-note] PASS (7 assertions) dynamic deployment target + bounded batches");
