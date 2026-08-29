import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), ".tmp-retry-policy-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
try {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsc", "lib/retry-policy.ts", "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir], { stdio: "inherit" });
  const file = join(outDir, "retry-policy.js");
  assert.equal(existsSync(file), true);
  const require = createRequire(import.meta.url);
  const { isRetryableFailure, retryDelayMs, canRetry } = require(file);
  assert.equal(isRetryableFailure("timeout"), true);
  assert.equal(isRetryableFailure("rate_limit"), true);
  assert.equal(isRetryableFailure("server_error"), true);
  assert.equal(isRetryableFailure("bad_request"), false);
  assert.equal(retryDelayMs(1, { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 500 }), 100);
  assert.equal(retryDelayMs(3, { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 250 }), 250);
  assert.equal(canRetry(0, { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 500 }), true);
  assert.equal(canRetry(2, { maxRetries: 2, baseDelayMs: 100, maxDelayMs: 500 }), false);
  console.log("[retry-policy-unit] PASS (8 assertions)");
} finally { rmSync(outDir, { recursive: true, force: true }); }
