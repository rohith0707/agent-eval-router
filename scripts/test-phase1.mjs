import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");

// Single-page product: 10-second problem → solution flow, no sidebar.
assert.match(page, /fetch\("\/api\/evidence"\)/);
assert.match(page, /EvidenceRank Leaderboard/);
assert.match(page, /data\.evidenceRank\[0\]\.model/);
assert.match(page, /data\.evidenceRank\[0\]\.avgQuality/);
assert.match(page, /data\.evidenceRank\[0\]\.avgLatencyMs/);
assert.match(page, /data\.evidenceRank\[0\]\.costPerQuality/);

// The page must declare the problem explicitly so a CTO understands it in 10 seconds.
assert.match(page, /AI models ship every day/);
assert.match(page, /Quality drops\. Costs spike\./);

// No sidebar, no decoration, no carousel. Single column.
assert.doesNotMatch(page, /Sidebar/);
assert.doesNotMatch(page, /Candidate Rejection Rationale/);
assert.doesNotMatch(page, /Interactive Routing Hook/);
assert.doesNotMatch(page, /Live 4-Provider Cascade/);

console.log("Phase 1 product contract: PASS");
