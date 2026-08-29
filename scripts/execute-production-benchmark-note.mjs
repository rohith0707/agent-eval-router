import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/benchmark-production.yml", "utf8");
const baseUrlMatch = workflow.match(/BASE_URL:\s*(https:\/\/[^\s]+)\s*/);
assert.ok(baseUrlMatch, "Workflow must define an HTTPS BASE_URL");
const baseUrl = baseUrlMatch[1].replace(/["']+$/g, "");
assert.match(baseUrl, /^https:\/\//);
assert.match(baseUrl, /(?:vercel\.app|vercel\.sh)$/);

console.log(`[benchmark] target configured: ${baseUrl}/api/benchmark`);
