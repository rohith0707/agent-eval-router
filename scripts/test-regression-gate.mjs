import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".tmp-regression-gate-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

try {
  if (process.platform === "win32") {
    execSync(`npx.cmd tsc lib/regression-gate.ts --target ES2022 --module commonjs --moduleResolution node --skipLibCheck --outDir "${outDir}"`, { cwd: root, stdio: "inherit" });
  } else {
    execFileSync("npx", [
      "tsc", "lib/regression-gate.ts", "--target", "ES2022", "--module", "commonjs",
      "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir,
    ], { cwd: root, stdio: "inherit" });
  }

  const compiled = join(outDir, "regression-gate.js");
  assert.equal(existsSync(compiled), true);
  const require = createRequire(import.meta.url);
  const { evaluateRegressionGate } = require(compiled);

  const healthy = Array.from({ length: 20 }, (_, index) => ({
    caseId: `case-${index}`,
    category: "reasoning",
    passed: index !== 19,
    latencyMs: 100 + index,
    costUsd: 0.002,
  }));
  const result = evaluateRegressionGate(healthy, {
    minQuality: 0.95,
    maxFailureRate: 0.05,
    maxP95LatencyMs: 130,
    maxCostPerRunUsd: 0.003,
  });
  assert.equal(result.passed, true);
  assert.equal(result.quality, 0.95);
  assert.equal(result.failureRate, 0.05);
  assert.equal(result.p95LatencyMs, 119);

  const badQuality = [...healthy, {
    caseId: "case-20", category: "regression", passed: false, latencyMs: 110, costUsd: 0.002,
  }];
  const qualityFailure = evaluateRegressionGate(badQuality, {
    minQuality: 0.95,
    maxFailureRate: 0.05,
    maxP95LatencyMs: 130,
    maxCostPerRunUsd: 0.003,
  });
  assert.equal(qualityFailure.passed, false);
  assert.match(qualityFailure.failures.join("; "), /quality/);

  const latencyFailure = evaluateRegressionGate(healthy.map((run) => ({ ...run, latencyMs: 500 })), {
    minQuality: 0.95,
    maxFailureRate: 0.05,
    maxP95LatencyMs: 130,
    maxCostPerRunUsd: 0.003,
  });
  assert.equal(latencyFailure.passed, false);
  assert.match(latencyFailure.failures.join("; "), /p95 latency/);

  const costFailure = evaluateRegressionGate(healthy.map((run) => ({ ...run, costUsd: 0.01 })), {
    minQuality: 0.95,
    maxFailureRate: 0.05,
    maxP95LatencyMs: 130,
    maxCostPerRunUsd: 0.003,
  });
  assert.equal(costFailure.passed, false);
  assert.match(costFailure.failures.join("; "), /cost\/run/);

  assert.throws(
    () => evaluateRegressionGate([], {
      minQuality: 0.95, maxFailureRate: 0.05, maxP95LatencyMs: 130, maxCostPerRunUsd: 0.003,
    }),
    /at least one benchmark result/,
  );

  console.log("[regression-gate-unit] PASS (12 assertions)");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
