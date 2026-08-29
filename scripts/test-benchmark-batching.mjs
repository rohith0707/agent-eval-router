import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".tmp-benchmark-batching-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

try {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "tsc", "lib/benchmark-batching.ts", "--target", "ES2022", "--module", "commonjs",
    "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir,
  ], { cwd: root, stdio: "inherit" });

  const compiled = join(outDir, "benchmark-batching.js");
  assert.equal(existsSync(compiled), true);
  const require = createRequire(import.meta.url);
  const { createBenchmarkBatches, normalizeBenchmarkBatch } = require(compiled);

  const batches = createBenchmarkBatches();
  assert.equal(batches.length, 10);
  assert.deepEqual(batches[0], { start: 0, limit: 5 });
  assert.deepEqual(batches[9], { start: 45, limit: 5 });
  assert.equal(batches.reduce((sum, batch) => sum + batch.limit, 0), 50);

  assert.deepEqual(normalizeBenchmarkBatch(0, 5), { start: 0, limit: 5 });
  assert.deepEqual(normalizeBenchmarkBatch(48, 5), { start: 48, limit: 2 });
  assert.throws(() => normalizeBenchmarkBatch(-1, 5), /integer from 0 to 49/);
  assert.throws(() => normalizeBenchmarkBatch(50, 5), /integer from 0 to 49/);
  assert.throws(() => normalizeBenchmarkBatch(0, 6), /integer from 1 to 5/);
  assert.throws(() => createBenchmarkBatches(0), /integer from 1 to 5/);

  console.log("[benchmark-batching-unit] PASS (11 assertions)");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
