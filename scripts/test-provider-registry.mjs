import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".tmp-provider-registry-test");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

try {
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", [
    "tsc", "lib/providers.ts", "lib/config.ts", "--target", "ES2022", "--module", "commonjs",
    "--moduleResolution", "node", "--skipLibCheck", "--outDir", outDir,
  ], { cwd: root, stdio: "inherit" });

  const require = createRequire(import.meta.url);
  const { modelRegistry } = require(join(outDir, "providers.js"));
  const registry = modelRegistry();

  const allModels = Object.values(registry).flat();
  for (const stale of [
    "gemini-2.5-flash-lite",
    "meta/llama-3.2-1b-instruct",
    "meta/llama-3.2-3b-instruct",
    "meta/llama-3.1-8b-instruct",
  ]) {
    assert.equal(allModels.includes(stale), false, `stale model must not be in registry: ${stale}`);
  }

  assert.ok(registry.gemini.includes("gemini-3.5-flash-lite"));
  assert.ok(registry.huggingface.includes("openai/gpt-oss-120b:fastest"));
  assert.ok(registry.nvidia.includes("openai/gpt-oss-20b"));
  assert.ok(registry.openrouter.includes("openrouter/free"));

  console.log("[provider-registry-unit] PASS (9 assertions)");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
