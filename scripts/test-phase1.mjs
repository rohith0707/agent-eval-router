import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const agentPage = await readFile("app/agent/page.tsx", "utf8");

// Product contract: the root experience is the autonomous AI control plane.
// Validate stable product language and data contracts, not exact implementation syntax.
assert.match(page, /import AgentControlPlane from "\.\/agent\/page"/);
assert.match(page, /<AgentControlPlane \/>/);
assert.match(agentPage, /AI execution control plane/);
assert.match(agentPage, /Make AI work\.<br \/>.*Make it earn DONE/);
assert.match(agentPage, /AUTONOMOUS WORK \/ EXECUTION CONTROL/);
assert.match(agentPage, /agents\?\s*:\s*Agent\[\]/);
assert.match(agentPage, /const agents = result\?\.agents \?\? \[\];/);
assert.match(agentPage, /trajectory\?\s*:\s*\{\s*step:\s*string;\s*status:\s*string/);
assert.match(agentPage, /const trajectory = result\?\.trajectory \?\? \[\];/);
assert.match(agentPage, /LIVE RUNTIME/);
assert.match(agentPage, /REAL WORK, NOT CHAT/);
assert.match(agentPage, /WHY THIS CAN BE TRUSTED/);
assert.match(agentPage, /decision ledger and runtime detail/);
assert.match(agentPage, /TIME TO DECISION/);
assert.match(agentPage, /Run task →/);
assert.match(agentPage, /verification gates/);

console.log("Control-tower agent product contract: PASS");

assert.match(agentPage, /THE INTERESTING PART/);
assert.match(agentPage, /No proof → no DONE\./);

assert.match(agentPage, /UNDER THE HOOD/);
assert.match(agentPage, /PARALLEL PROOF/);
assert.match(agentPage, /SELECTED ROUTE/);
