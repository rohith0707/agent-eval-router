import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");

// Assertions to verify the production command center view
assert.match(page, /fetch\("\/api\/evidence"\)/);
assert.match(page, /EvidenceRank Leaderboard/);
assert.match(page, /AGENT EVAL ROUTER/);
assert.match(page, /Live 4-Provider Failover & Cost Cascade/);
assert.match(page, /Interactive Monthly Inference ROI/);

console.log("Phase 1 product contract: PASS");
