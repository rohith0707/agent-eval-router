import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile("app/api/agent/route.ts", "utf8");
const verifier = await readFile("backend/app/agent/verification.py", "utf8");
const graph = await readFile("backend/app/agent/graph.py", "utf8");
const workspace = await readFile("app/workspace/page.tsx", "utf8");

assert.match(route, /independent_verifier_unavailable/);
assert.match(route, /passed: false/);
assert.match(route, /VERIFICATION_INCOMPLETE/);
assert.match(verifier, /No independently configured verifier provider/);
assert.match(verifier, /LIVE_INDEPENDENT_VERIFIER/);
assert.match(graph, /verification_incomplete/);
assert.match(graph, /loop_action.*ESCALATE/);
assert.doesNotMatch(workspace, /\/api\/agent\/demo/);
assert.doesNotMatch(workspace, /Use demo/);
assert.match(workspace, /\/api\/agent/);

console.log("[verification-contract] PASS");
