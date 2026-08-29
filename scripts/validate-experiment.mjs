import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const experiment = readFileSync(join(root, "lib", "experiment.ts"), "utf8");
const route = readFileSync(join(root, "app", "api", "experiment", "route.ts"), "utf8");
const benchmark = JSON.parse(readFileSync(join(root, "benchmarks", "routing-bench-v1.json"), "utf8"));

if (!Array.isArray(benchmark) || benchmark.length !== 50) throw new Error("Experiment benchmark must contain exactly 50 cases");

const required = [
  [experiment, '"baseline"', "fixed baseline strategy"],
  [experiment, '"cheapest"', "cheapest viable strategy"],
  [experiment, '"adaptive"', "adaptive strategy"],
  [experiment, "taskSuccessRate", "task success metric"],
  [experiment, "costPerSuccessfulTaskUsd", "cost per successful task metric"],
  [experiment, "fallbackRate", "fallback rate metric"],
  [experiment, "adaptiveCandidates", "adaptive candidate policy"],
  [route, "experiment_summary_", "persisted experiment summary"],
  [route, "cases: 50", "50-case experiment contract"],
  [route, "adaptiveVsBaseline", "baseline comparison"],
  [route, "adaptiveVsCheapest", "cheapest comparison"],
];

for (const [source, token, label] of required) {
  if (!source.includes(token)) throw new Error(`Experiment contract missing: ${label} (${token})`);
}

console.log("[experiment-contract] fixed/cheapest/adaptive comparison and 50-case metrics validated");
