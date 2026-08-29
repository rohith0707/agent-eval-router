import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "app");

function source(path: string) {
  return readFileSync(join(appRoot, path), "utf8");
}

describe("routing intelligence and trace explorer contracts", () => {
  it("keeps routing and trace surfaces backed by persisted run evidence", () => {
    const page = source("[...slug]/page.tsx");
    expect(page).toContain("/api/runs");
    expect(page).toContain("selectedModel");
    expect(page).toContain("routingReason");
    expect(page).toContain("trace");
  });

  it("exposes candidate, routing and execution evidence without provider secrets", () => {
    const page = source("[...slug]/page.tsx");
    expect(page).toContain("candidates");
    expect(page).toContain("fallback");
    expect(page).toContain("latency");
    expect(page).not.toMatch(/process\.env\.[A-Z0-9_]+/);
  });

  it("keeps the run API as the evidence source", () => {
    const api = source("api/runs/route.ts");
    expect(api).toContain("getRecentRuns");
    expect(api).toContain("NextResponse.json");
  });
});
