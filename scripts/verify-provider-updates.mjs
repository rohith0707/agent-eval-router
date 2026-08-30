import { promises as fs } from "fs";
import { execSync } from "child_process";

async function main() {
  const sourcePath = "lib/providers.ts";
  const source = await fs.readFile(sourcePath, "utf8");

  // Run test-provider-registry.mjs to get current pass/fail status
  let testResult;
  try {
    execSync("node scripts/test-provider-registry.mjs", { stdio: "pipe" });
    testResult = { passed: true };
  } catch (error) {
    testResult = { passed: false, output: error.stdout?.toString() ?? error.stderr?.toString() ?? String(error) };
  }

  // Define stale and current models as in test script
  const staleModels = [
    "gemini-2.5-flash-lite",
    "meta/llama-3.2-1b-instruct",
    "meta/llama-3.2-3b-instruct",
    "meta/llama-3.1-8b-instruct",
  ];
  const currentModels = [
    "gemini-3.5-flash-lite",
    "openai/gpt-oss-120b:fastest",
    "openai/gpt-oss-20b",
    "openrouter/free",
  ];

  const stalePresent = staleModels.some((model) => source.includes(`"${model}"`));
  const currentPresent = currentModels.every((model) => source.includes(`"${model}"`));

  if (!testResult.passed) {
    console.error(`[verify-provider-updates] FAIL: test-provider-registry.mjs is failing`);
    process.exit(1);
  }

  if (stalePresent) {
    console.error(`[verify-provider-updates] FAIL: stale models still present in providers.ts`);
    process.exit(1);
  }

  if (!currentPresent) {
    console.error(`[verify-provider-updates] FAIL: some current models missing from providers.ts`);
    process.exit(1);
  }

  console.log("[verify-provider-updates] PASS: Provider registry is up to date");
}

main().catch((err) => {
  console.error("[verify-provider-updates] Unexpected error:", err);
  process.exit(1);
});