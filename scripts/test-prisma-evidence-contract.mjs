import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = process.cwd();
const schema = readFileSync(`${root}/prisma/schema.prisma`, "utf8");
const evidence = readFileSync(`${root}/app/api/evidence/route.ts`, "utf8");
const persistence = readFileSync(`${root}/app/api/persistence/route.ts`, "utf8");

assert.match(schema, /model EvaluationRun/);
assert.match(schema, /cost\s+Float/);
assert.doesNotMatch(schema, /provider\s+String/);
assert.doesNotMatch(schema, /category\s+String/);
assert.doesNotMatch(schema, /strategy\s+String/);
assert.doesNotMatch(schema, /costUsd\s+Float/);

assert.match(evidence, /costUsd: row\.cost/);
assert.match(evidence, /deriveMetadata\(row\)/);
assert.match(evidence, /candidatesJson/);
assert.match(evidence, /traceJson/);
assert.doesNotMatch(evidence, /provider:\s*r\.provider/);
assert.doesNotMatch(evidence, /category:\s*r\.category/);
assert.doesNotMatch(evidence, /strategy:\s*r\.strategy/);
assert.doesNotMatch(evidence, /costUsd:\s*r\.costUsd/);

assert.match(persistence, /cost,/);
assert.match(persistence, /body\.provider/);
assert.match(persistence, /body\.category/);
assert.match(persistence, /body\.strategy/);
assert.match(persistence, /costUsd/);
assert.doesNotMatch(persistence, /^\s*provider:\s*String\(body\.provider/m);
assert.doesNotMatch(persistence, /^\s*category:\s*String\(body\.category/m);
assert.doesNotMatch(persistence, /^\s*strategy:\s*String\(body\.strategy/m);
assert.doesNotMatch(persistence, /^\s*costUsd:/m);

console.log("[prisma-evidence-contract] PASS (20 assertions)");
