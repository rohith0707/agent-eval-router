import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const sidebar = await readFile("app/components/Sidebar.tsx", "utf8");
const live = await readFile("app/live/page.tsx", "utf8");

// Phase 1 product contract: the control plane must be backed by persisted evidence,
// not hard-coded dashboard metrics or decorative-only navigation.
assert.match(page, /fetch\("\/api\/runs"/);
assert.match(page, /summary\?\.avgQuality/);
assert.match(page, /summary\?\.p95LatencyMs/);
assert.match(page, /passedRuns\.length/);
assert.match(page, /unresolvedRuns\.length/);
assert.match(page, /hasEvidence/);
assert.match(page, /Expected reference/);
assert.match(page, /Actual output/);
assert.match(page, /Task-specific grader/);
assert.match(page, /selectionRationale/);
assert.match(page, /No improvement claim is shown until/);

// The five Phase 1 control-plane destinations must remain real routes.
for (const route of ["/", "/live", "/benchmarks", "/models", "/runs"]) {
  assert.match(sidebar, new RegExp(`href: \\"${route.replace("/", "\\/")}\\"`));
}

// Product AI Lab must execute the real API and expose decision/evaluation evidence.
assert.match(live, /fetch\("\/api\/live-evaluate"/);
assert.match(live, /decision\?\.reason/);
assert.match(live, /metrics\?\.quality/);
assert.match(live, /metrics\?\.latencyMs/);
assert.match(live, /fallbackCount/);
assert.match(live, /result\.trace/);
assert.match(live, /result\.persisted/);

console.log("Phase 1 product contract: PASS");
