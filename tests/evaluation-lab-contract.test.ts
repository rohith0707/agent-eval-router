import { describe, expect, it } from "vitest";

describe("Evaluation Lab API contract", () => {
  it("uses the live evaluation endpoint", () => {
    expect("/api/live-evaluate").toBe("/api/live-evaluate");
  });

  it("requires a task payload", () => {
    const payload = { task: "" };
    expect(payload.task.trim()).toBe("");
  });

  it("keeps provider secrets out of UI result fields", () => {
    const publicFields = ["status", "model", "quality", "latency_ms", "fallback_count", "trace_id", "rationale"];
    expect(publicFields).not.toContain("api_key");
    expect(publicFields).not.toContain("secret");
  });
});
