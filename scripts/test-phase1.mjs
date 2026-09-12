import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");

// Phase 1 product contract:
// - Live multi-provider evaluation
// - EvidenceRank leaderboard across all 4 providers
// - Explainable decisions ("why this model?")
assert.match(page, /fetch\("\/api\/evidence"\)/);
assert.match(page, /EvidenceRank Leaderboard/);
assert.match(page, /EVIDENCE ROUTER/);
assert.match(page, /DECISION RATIONALE/);
assert.match(page, /EVIDENCE TRACE/);
assert.match(page, /\[ Solve → \]/);

console.log("Phase 1 product contract: PASS");
