import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const sidebar = await readFile("app/components/Sidebar.tsx", "utf8");

// CTO-ready dashboard contract: the control plane must show a single decision driven
// by EvidenceRank, fetched from the evidence API.
assert.match(page, /fetch\("\/api\/evidence"\)/);
assert.match(page, /EvidenceRank:/);
assert.match(page, /winner\.avgQuality/);
assert.match(page, /winner\.avgLatencyMs/);
assert.match(page, /winner\.costPerQuality/);
assert.match(page, /Why This Model Won/);
assert.match(page, /Candidate Rejection Rationale/);
assert.match(page, /EvidenceRank Leaderboard/);

// The sidebar must be reduced to the 3 core CTO-ready tabs to eliminate bloat.
for (const route of ["/", "/evidence", "/settings"]) {
  assert.match(sidebar, new RegExp(`href: "${route.replace("/", "\\/")}"`));
}

// Brand must represent business value
assert.match(sidebar, /Evidence-Based LLM Routing/);

console.log("Phase 1 product contract: PASS");
