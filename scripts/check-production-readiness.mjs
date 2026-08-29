import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const doc = readFileSync("docs/production-readiness.md", "utf8");
for (const term of ["real configured provider", "persisted", "timeout/retry/fallback", "cost", "50-case benchmark", "regression gate", "Security guardrails"]) {
  assert.match(doc, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
console.log("[production-readiness] PASS (7 assertions)");
