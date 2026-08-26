import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const config = readFileSync(join(root, "lib", "config.ts"), "utf8");
const providers = readFileSync(join(root, "lib", "providers.ts"), "utf8");
const oxAlpha = readFileSync(join(root, "lib", "ox-alpha.ts"), "utf8");
const gateway = readFileSync(join(root, "app", "api", "gateway", "route.ts"), "utf8");
const benchmark = readFileSync(join(root, "app", "api", "benchmark", "route.ts"), "utf8");
const meta = readFileSync(join(root, "app", "api", "meta", "route.ts"), "utf8");
const dashboardShell = readFileSync(join(root, "app", "components", "DashboardShell.tsx"), "utf8");
const apimPolicy = readFileSync(join(root, "infra", "apim", "policy.xml"), "utf8");

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
  [oxAlpha, 'stealth/ox-alpha', "Ox Alpha model id"],
  [oxAlpha, "runOxAlpha", "Ox Alpha adapter"],
  [gateway, "GATEWAY_RATE_LIMIT_PER_MINUTE", "gateway rate limit"],
  [gateway, "ox-alpha-escalation", "Ox Alpha gateway policy"],
  [gateway, "cost-first-cascade", "cost-first gateway policy"],
  [meta, "VERCEL_GIT_COMMIT_SHA", "deployment commit fingerprint"],
  [meta, "VERCEL_GIT_COMMIT_REF", "deployment branch fingerprint"],
  [dashboardShell, "fetch(\"/api/meta\"", "dashboard build verification"],
  [dashboardShell, "Build {build ? shortSha(build.commit) : \"checking…\"}", "visible build fingerprint"],
  [apimPolicy, "rate-limit-by-key", "APIM rate limiting policy"],
  [apimPolicy, "quota-by-key", "APIM quota policy"],
];

for (const [source, token, label] of required) {
  if (!source.includes(token)) {
    throw new Error(`Production contract missing: ${label} (${token})`);
  }
}

console.log("[production-contract] provider aliases, benchmark budget, Ox Alpha escalation, APIM gateway, and deployment fingerprint contract validated");
