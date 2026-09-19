import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const agentPage = await readFile("app/agent/page.tsx", "utf8");

// Product contract: the root experience is the autonomous AI control plane.
// Validate stable product language and data contracts, not exact implementation syntax.
assert.match(page, /import AgentControlPlane from "\.\/agent\/page"/);
assert.match(page, /<AgentControlPlane \/>/);
assert.match(agentPage, /Autonomous AI work, with proof\./);
assert.match(agentPage, /Give AI a job\. Get a verified decision\./);
assert.match(agentPage, /CONTROLLED AUTONOMY/);
assert.match(agentPage, /agents\?\s*:\s*Agent\[\]/);
assert.match(agentPage, /const agents = result\?\.agents \?\? \[\];/);
assert.match(agentPage, /trajectory\?\s*:\s*\{\s*step:\s*string;\s*status:\s*string/);
assert.match(agentPage, /const trajectory = result\?\.trajectory \?\? \[\];/);
assert.match(agentPage, /SIMULATED DEMO|DEMO/);
assert.match(agentPage, /WHAT THE SYSTEM ACTUALLY DID/);
assert.match(agentPage, /WHY CAN WE TRUST THIS RESULT/);
assert.match(agentPage, /DECISION LEDGER/);
assert.match(agentPage, /TIME TO VERIFIED DECISION/);
assert.match(agentPage, /Start controlled run →/);
assert.match(agentPage, /Repair ≤/);
assert.match(agentPage, /verification gates/);

console.log("Control-tower agent product contract: PASS");
