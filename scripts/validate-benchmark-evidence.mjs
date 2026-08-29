import { readFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "benchmarks", "routing-bench-v1.jsonl");
const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
if (lines.length !== 50) throw new Error(`Benchmark evidence requires 50 cases; found ${lines.length}`);

const cases = lines.map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`Invalid benchmark case at line ${index + 1}: ${error.message}`); }
});

const ids = new Set(cases.map((item) => item.id));
if (ids.size !== 50) throw new Error("Benchmark case IDs must be unique");

for (const item of cases) {
  if (!item.id || !item.category || !item.task || !item.expected_behavior) {
    throw new Error(`Benchmark case ${item.id ?? "<unknown>"} is incomplete`);
  }
}

console.log(JSON.stringify({
  benchmark: "routing-bench-v1",
  cases: cases.length,
  categories: [...new Set(cases.map((item) => item.category))].length,
  evidence_ready: true,
  message: "Benchmark definition is ready for real execution; no synthetic results are reported.",
}, null, 2));
