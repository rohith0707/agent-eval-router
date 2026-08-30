import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "benchmarks", "routing-bench-v1.json");
const cases = JSON.parse(readFileSync(file, "utf8"));

if (!Array.isArray(cases)) {
  throw new Error("Benchmark definition must be a JSON array");
}

if (cases.length !== 50) {
  throw new Error(`Benchmark must contain exactly 50 cases; found ${cases.length}`);
}

const ids = cases.map((item) => item.id);
if (new Set(ids).size !== ids.length) {
  throw new Error("Benchmark contains duplicate case IDs");
}

const categories = new Map();
for (const item of cases) {
  if (!item.id || !item.category || !item.task || !item.expected_behavior) {
    throw new Error(`Case ${item.id ?? "<unknown>"} is missing required fields`);
  }
  categories.set(item.category, (categories.get(item.category) ?? 0) + 1);
}

const expectedCategories = [
  "reasoning",
  "structured_output",
  "tool_calling",
  "rag",
  "agent_planning",
  "reliability",
  "text_to_sql",
  "safety",
  "code_generation",
  "regression",
];

for (const category of expectedCategories) {
  const count = categories.get(category) ?? 0;
  if (count !== 5) {
    throw new Error(`Category ${category} must contain 5 cases; found ${count}`);
  }
}

if (categories.size !== expectedCategories.length) {
  throw new Error(`Unexpected benchmark categories: ${[...categories.keys()].join(", ")}`);
}

console.log("[benchmark] validated: 50 unique cases across 10 categories");
