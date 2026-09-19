import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const agentPage = await readFile("app/agent/page.tsx", "utf8");

// Product contract: the root experience is the autonomous agent control plane.
// Validate stable product language and data contracts, not exact implementation syntax.
assert.match(page, /import AgentControlPlane from "\.\/agent\/page"/);
assert.match(page, /<AgentControlPlane \/>/);
assert.match(agentPage, /From task to verified decision in seconds\./);
assert.match(agentPage, /agents\?\s*:\s*Agent\[\]/);
assert.match(agentPage, /result\.agents\s*\?\?\s*\[\]/);
assert.match(agentPage, /trajectory\?\s*:\s*\{\s*step:\s*string;\s*status:\s*string/);
assert.match(agentPage, /result\.trajectory\s*\?\?\s*\[\]/);
assert.match(agentPage, /SIMULATED DEMO/);
assert.match(agentPage, /What the system actually did/);
assert.match(agentPage, /Why can we trust this result/);
assert.match(agentPage, /DECISION LEDGER/);
assert.match(agentPage, /TIME TO DECISION/);
assert.match(agentPage, /Run agent →/);

console.log("Outcome-first agent control-plane product contract: PASS");
