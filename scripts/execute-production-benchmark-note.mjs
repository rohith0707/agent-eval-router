import assert from "node:assert/strict";

const baseUrl = "https://agent-eval-router-balsarohith5-5561s-projects.vercel.app";
assert.match(baseUrl, /^https:\/\//);
assert.match(baseUrl, /vercel\.app$/);
console.log(`[benchmark] target configured: ${baseUrl}/api/benchmark`);
