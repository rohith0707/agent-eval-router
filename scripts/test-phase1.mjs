import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const agentPage = await readFile("app/agent/page.tsx", "utf8");

// Product contract: the root experience is the autonomous AI control plane.
// Validate stable product language and data contracts, not exact implementation syntax.
assert.match(page, /import AgentControlPlane from "\.\/agent\/page"/);
assert.match(page, /<AgentControlPlane \/>/);
assert.match(agentPage, /Autonomous AI work, with proof\./);
assert.match(agentPage, /AI can do the work\.<br \/>.*We make it prove the work/);
assert.match(agentPage, /AI WORK, WITH A STOP CONDITION/);
assert.match(agentPage, /agents\?\s*:\s*Agent\[\]/);
assert.match(agentPage, /const agents = result\?\.agents \?\? \[\];/);
assert.match(agentPage, /trajectory\?\s*:\s*\{\s*step:\s*string;\s*status:\s*string/);
assert.match(agentPage, /const trajectory = result\?\.trajectory \?\? \[\];/);
assert.match(agentPage, /SIMULATED DEMO|DEMO/);
assert.match(agentPage, /WHAT THE SYSTEM ACTUALLY DID/);
assert.match(agentPage, /WHY CAN WE TRUST THIS RESULT/);
assert.match(agentPage, /DECISION LEDGER/);
assert.match(agentPage, /TIME TO VERIFIED DECISION/);
assert.match(agentPage, /See the agent prove a fix →/);
assert.match(agentPage, /verification gates/);

console.log("Control-tower agent product contract: PASS");

assert.match(agentPage, /THE PRODUCT IN ONE SENTENCE/);
assert.match(agentPage, /No proof → no DONE\./);

assert.match(agentPage, /LIVE ROUTER/);
assert.match(agentPage, /RUNNING IN PARALLEL/);
assert.match(agentPage, /ROUTER DECISION/);
