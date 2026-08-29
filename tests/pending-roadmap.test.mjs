import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const scripts = packageJson.scripts;

assert.equal(typeof scripts.test, "string");
assert.equal(typeof scripts.test:regression-gate, "string");
assert.equal(typeof scripts.test:benchmark-evidence, "string");

console.log("[pending-roadmap] CI test surface present");
