import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), ".tmp-observability-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
try {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsc", "lib/observability.ts", "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir], { stdio: "inherit", shell: process.platform === "win32" });
  const file = join(outDir, "observability.js");
  assert.equal(existsSync(file), true);
  const require = createRequire(import.meta.url);
  const { normalizeExecutionEvidence } = require(file);
  const result = normalizeExecutionEvidence({ runId: "r1", model: "m1", provider: "p1", inputTokens: -2, outputTokens: 8, latencyMs: -5, costUsd: -1, fallbackCount: -3, evaluationQuality: 2, status: "passed" });
  assert.equal(result.inputTokens, 0);
  assert.equal(result.outputTokens, 8);
  assert.equal(result.latencyMs, 0);
  assert.equal(result.costUsd, 0);
  assert.equal(result.fallbackCount, 0);
  assert.equal(result.evaluationQuality, 1);
  assert.equal(result.status, "passed");
  console.log("[observability-unit] PASS (7 assertions)");
} finally { rmSync(outDir, { recursive: true, force: true }); }
