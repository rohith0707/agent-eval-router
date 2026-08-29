import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/benchmark-production.yml", "utf8");
assert.match(workflow, /POST .*\/api\/benchmark/s);
assert.match(workflow, /Expected 50 cases/);
assert.match(workflow, /Expected 50 evaluated cases/);
assert.match(workflow, /upload-artifact@v4/);
assert.match(workflow, /agent-eval-router\.vercel\.app/);
console.log("[production-benchmark-workflow] PASS (5 assertions)");
