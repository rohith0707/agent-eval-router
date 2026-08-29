import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".tmp-benchmark-evidence-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

try {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "tsc", "lib/benchmark-evidence.ts", "--target", "ES2022", "--module", "commonjs",
    "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir,
  ], { cwd: root, stdio: "inherit" });

  const compiled = join(outDir, "benchmark-evidence.js");
  assert.equal(existsSync(compiled), true);
  const require = createRequire(import.meta.url);
  const { summarizeBenchmark } = require(compiled);

  const rows = [
    { caseId: "a", category: "reasoning", model: "model-a", passed: true, latencyMs: 100, costUsd: 0.002, fallback: false },
    { caseId: "b", category: "reasoning", model: "model-a", passed: true, latencyMs: 120, costUsd: 0.004, fallback: false },
    { caseId: "c", category: "rag", model: "model-a", passed: false, latencyMs: 200, costUsd: 0.006, fallback: true },
    { caseId: "d", category: "reasoning", model: "model-b", passed: true, latencyMs: 80, costUsd: 0.001, fallback: false },
  ];

  const summaries = summarizeBenchmark(rows);
  assert.equal(summaries.length, 2);
  const a = summaries.find((item) => item.model === "model-a");
  assert.equal(a.cases, 3);
  assert.equal(a.taskSuccess, 2 / 3);
  assert.equal(a.failureRate, 1 / 3);
  assert.equal(a.fallbackRate, 1 / 3);
  assert.equal(a.costPerTaskUsd, 0.004);
  assert.equal(a.p95LatencyMs, 200);
  assert.throws(() => summarizeBenchmark([]), /at least one observation/);

  console.log("[benchmark-evidence-unit] PASS (10 assertions)");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
