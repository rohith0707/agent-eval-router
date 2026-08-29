import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/providers.ts", "utf8");

for (const stale of [
  "gemini-2.5-flash-lite",
  "meta/llama-3.2-1b-instruct",
  "meta/llama-3.2-3b-instruct",
  "meta/llama-3.1-8b-instruct",
]) {
  assert.equal(source.includes(`\"${stale}\"`), false, `stale model must not be in registry: ${stale}`);
}

for (const current of [
  "gemini-3.5-flash-lite",
  "openai/gpt-oss-120b:fastest",
  "openai/gpt-oss-20b",
  "openrouter/free",
]) {
  assert.equal(source.includes(`\"${current}\"`), true, `current model must be in registry: ${current}`);
}

assert.match(source, /MODEL_REGISTRY[\s\S]*gemini-3\.5-flash-lite/);
assert.match(source, /MODEL_REGISTRY[\s\S]*openai\/gpt-oss-120b:fastest/);
assert.match(source, /MODEL_REGISTRY[\s\S]*openai\/gpt-oss-20b/);

console.log("[provider-registry-unit] PASS (11 assertions)");
