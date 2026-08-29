import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), ".tmp-input-security-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
try {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsc", "lib/input-security.ts", "--target", "ES2022", "--module", "commonjs", "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir], { stdio: "inherit" });
  const file = join(outDir, "input-security.js");
  assert.equal(existsSync(file), true);
  const require = createRequire(import.meta.url);
  const { normalizeTaskInput, redactSecrets, limitOutput, MAX_TASK_LENGTH } = require(file);
  const normal = normalizeTaskInput("  hello  ");
  assert.equal(normal.task, "hello");
  assert.equal(normal.truncated, false);
  const long = normalizeTaskInput("x".repeat(MAX_TASK_LENGTH + 5));
  assert.equal(long.task.length, MAX_TASK_LENGTH);
  assert.equal(long.truncated, true);
  assert.equal(redactSecrets("api_key=abc123 Authorization: secret").includes("abc123"), false);
  assert.equal(redactSecrets("Bearer abc123").includes("abc123"), false);
  assert.equal(limitOutput("x".repeat(40_000)).length, 32_001);
  console.log("[input-security-unit] PASS (6 assertions)");
} finally { rmSync(outDir, { recursive: true, force: true }); }
