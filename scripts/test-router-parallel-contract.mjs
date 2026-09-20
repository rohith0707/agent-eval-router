import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile("app/api/router/stream/route.ts", "utf8");
const page = await readFile("app/agent/page.tsx", "utf8");

assert.match(route, /Promise\.all\(\s*providers\.map/);
assert.match(route, /await callProvider\(/);
assert.match(route, /let active = 0/);
assert.match(route, /maxConcurrent = Math\.max/);
assert.match(route, /type: "parallel_proof"/);
assert.match(route, /Multiple provider calls overlapped/);
assert.match(route, /expectedProviders/);
assert.match(page, /CONTROL-PLANE ARCHITECTURE/);
assert.match(page, /IDENTITY \/ PERMISSION/);
assert.match(page, /POLICY \+ RISK/);
assert.match(page, /ALLOW \/ REVIEW \/ BLOCK/);
assert.match(page, /ROUTER \+ TOOLS/);
assert.match(page, /PROOF \+ LEDGER/);
assert.match(page, /EVAL \/ REPLAY/);
assert.match(page, /PARALLEL PROOF/);
assert.match(page, /maxConcurrent/);

console.log("Parallel router + control-plane contract: PASS");
