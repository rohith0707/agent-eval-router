import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/meta/route.ts", "utf8");
assert.match(route, /success:\s*true/);
assert.match(route, /commit:\s*process\.env\.VERCEL_GIT_COMMIT_SHA/);
assert.match(route, /ref:\s*process\.env\.VERCEL_GIT_COMMIT_REF/);
assert.match(route, /environment:\s*process\.env\.VERCEL_ENV/);
assert.match(route, /deploymentUrl:\s*process\.env\.VERCEL_URL/);
console.log("[meta-contract-unit] PASS (5 assertions)");
