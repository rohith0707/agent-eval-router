import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const agentPage = await readFile("app/agent/page.tsx", "utf8");

// Product contract: the root experience is the autonomous agent control plane.
// Validate stable UI contracts, not exact implementation syntax or runtime values.
assert.match(page, /import AgentControlPlane from "\.\/agent\/page"/);
assert.match(page, /<AgentControlPlane \/>/);
assert.match(agentPage, /Autonomous Multi-Agent Software Engineer/);
assert.match(agentPage, /agents\?: Agent\[\]/);
assert.match(agentPage, /result\.agents \?\? \[\]/);
assert.match(agentPage, /trajectory\?\?: \{ step: string; status: string/);
assert.match(agentPage, /result\.trajectory \?\? \[\]/);
assert.match(agentPage, /SIMULATED DEMO/);
assert.match(agentPage, /Execution loop/);
assert.match(agentPage, /Evidence/);
assert.match(agentPage, /Decision/);
assert.match(agentPage, /Verification & runtime limits/);
assert.match(agentPage, /Run autonomous engineer/);

console.log("Autonomous agent control-plane product contract: PASS");
