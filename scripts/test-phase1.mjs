import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const agentPage = await readFile("app/agent/page.tsx", "utf8");

// Product contract: the root experience is the autonomous agent control plane.
// The legacy provider-router contract is intentionally no longer required at /.
assert.match(page, /import AgentControlPlane from "\.\/agent\/page"/);
assert.match(page, /<AgentControlPlane \/>/);
assert.match(agentPage, /Autonomous Multi-Agent Software Engineer/);
assert.match(agentPage, /Planner/);
assert.match(agentPage, /Investigator/);
assert.match(agentPage, /Implementer/);
assert.match(agentPage, /Tester/);
assert.match(agentPage, /Repairer/);
assert.match(agentPage, /Reviewer/);
assert.match(agentPage, /Verifier/);
assert.match(agentPage, /SIMULATED DEMO/);
assert.match(agentPage, /Evidence/);
assert.match(agentPage, /Decision/);

console.log("Autonomous agent control-plane product contract: PASS");
