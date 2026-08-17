import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const config = readFileSync(join(root, "lib", "config.ts"), "utf8");
const providers = readFileSync(join(root, "lib", "providers.ts"), "utf8");
const benchmark = readFileSync(join(root, "app", "api", "benchmark", "route.ts"), "utf8");

const required = [
  [config, "process.env.GEMINI_API_KEY", "canonical Gemini credential"],
  [config, "process.env.GOOGLE_API_KEY", "Google Gemini credential alias"],
  [config, "process.env.Gemini_API", "legacy Gemini Vercel alias"],
  [config, "process.env.HF_TOKEN", "canonical Hugging Face credential"],
  [config, "process.env.HUGGINGFACE_API_KEY", "Hugging Face credential alias"],
  [config, "process.env.Huggingface", "legacy Hugging Face Vercel alias"],
  [providers, "getGeminiApiKey()", "centralized Gemini resolver usage"],
  [providers, "getHuggingFaceToken()", "centralized Hugging Face resolver usage"],
  [benchmark, "BENCHMARK_ATTEMPT_TIMEOUT_MS = 3000", "benchmark attempt timeout"],
  [benchmark, "BENCHMARK_CASE_DEADLINE_MS = 10000", "benchmark case deadline"],
  [benchmark, 'type BenchmarkStatus = "passed" | "failed" | "infra_failed"', "infrastructure failure status"],
  [benchmark, "Provider preflight failed", "benchmark provider preflight"],
];

for (const [source, token, label] of required) {
  if (!source.includes(token)) {
    throw new Error(`Production contract missing: ${label} (${token})`);
  }
}

console.log("[production-contract] provider aliases, benchmark budget, and infra-failure contract validated");
