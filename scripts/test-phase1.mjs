import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");

// Phase 1 product contract:
// - Live multi-provider evaluation
// - EvidenceRank leaderboard across all 4 providers
// - Explainable decisions ("why this model?")
assert.match(page, /fetch\("\/api\/evidence"\)/);
assert.match(page, /EvidenceRank Leaderboard/);
assert.match(page, /AGENT EVAL ROUTER/);
assert.match(page, /Why did you choose this model\?/);
assert.match(page, /DECISIONS/);
assert.match(page, /Run Agent/);

console.log("Phase 1 product contract: PASS");
