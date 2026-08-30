/**
 * /api/evidence
 *
 * Returns recent evaluation evidence from PostgreSQL.
 * Provider/category/strategy are derived from the stored JSON evidence because
 * EvaluationRun intentionally keeps the canonical scalar schema compact.
 */

import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EvidenceRow = {
  id: string;
  externalId: string;
  task: string;
  status: string;
  selectedModel: string;
  provider: string;
  category: string;
  strategy: string;
  quality: number;
  latencyMs: number;
  costUsd: number;
  createdAt: string;
};

type EvidenceSummary = {
  total: number;
  passed: number;
  failed: number;
  averageQuality: number;
  averageLatencyMs: number;
  providerMix: Record<string, number>;
  categoryMix: Record<string, number>;
  strategyMix: Record<string, number>;
  recent: EvidenceRow[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function deriveMetadata(row: {
  candidatesJson: unknown;
  traceJson: unknown;
  selectedModel: string;
  reason: string;
}) {
  const candidates = asArray(row.candidatesJson)
    .map(asRecord)
    .filter((value): value is Record<string, unknown> => value !== null);
  const trace = asArray(row.traceJson)
    .map(asRecord)
    .filter((value): value is Record<string, unknown> => value !== null);

  const successAttempt = candidates.find((attempt) => attempt.outcome === "success");
  const provider = firstString(successAttempt?.provider, candidates[0]?.provider) ?? "unknown";

  const benchmarkCase = trace.find((step) => step.step === "Benchmark case");
  const categoryFromTrace = firstString(benchmarkCase?.category);
  const categoryFromReason = row.reason.match(/·\s*([^·]+)\s*·/)?.[1]?.trim();
  const category = categoryFromTrace ?? categoryFromReason ?? "general";

  const strategyStep = trace.find((step) => step.step === "Strategy" || step.step === "Experiment strategy");
  const strategy = firstString(strategyStep?.detail, strategyStep?.status) ?? "unknown";

  return { provider, category, strategy, selectedModel: row.selectedModel };
}

const DEMO_EVIDENCE: EvidenceRow[] = Array.from({ length: 50 }, (_, i) => {
  const providers = ["gemini", "huggingface", "nvidia", "openrouter"];
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "deepseek/deepseek-chat",
    "Qwen/Qwen3-Coder-480B",
    "meta/llama-3.3-70b-instruct",
  ];
  const categories = ["reasoning", "coding", "extraction", "creative", "classification", "math", "qa", "summarization"];
  const strategies = ["baseline", "cheapest", "adaptive"];
  const provider = providers[i % providers.length];
  const model = models[i % models.length];
  const category = categories[i % categories.length];
  const strategy = strategies[i % strategies.length];
  const quality = 0.88 + ((i * 7) % 12) / 100;
  const passed = quality >= 0.85;
  return {
    id: `demo-${i + 1}`,
    externalId: `benchmark-case-${String(i + 1).padStart(2, "0")}`,
    task: `${category} task ${i + 1}`,
    status: passed ? "passed" : "failed",
    selectedModel: model,
    provider,
    category,
    strategy,
    quality: Number(quality.toFixed(3)),
    latencyMs: 380 + (i * 47) % 1000,
    costUsd: Number((0.0003 + (i % 10) * 0.0001).toFixed(6)),
    createdAt: new Date(Date.now() - (50 - i) * 3600_000).toISOString(),
  };
});

function summarize(rows: EvidenceRow[]): EvidenceSummary {
  const passed = rows.filter((row) => row.status === "passed").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const total = rows.length;
  const averageQuality = total > 0 ? rows.reduce((sum, row) => sum + row.quality, 0) / total : 0;
  const latencies = rows.map((row) => row.latencyMs).filter((value) => Number.isFinite(value));
  const averageLatencyMs = latencies.length > 0 ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0;

  const providerMix: Record<string, number> = {};
  const categoryMix: Record<string, number> = {};
  const strategyMix: Record<string, number> = {};
  for (const row of rows) {
    providerMix[row.provider] = (providerMix[row.provider] ?? 0) + 1;
    categoryMix[row.category] = (categoryMix[row.category] ?? 0) + 1;
    strategyMix[row.strategy] = (strategyMix[row.strategy] ?? 0) + 1;
  }

  return {
    total,
    passed,
    failed,
    averageQuality: Number(averageQuality.toFixed(3)),
    averageLatencyMs: Math.round(averageLatencyMs),
    providerMix,
    categoryMix,
    strategyMix,
    recent: rows.slice(0, 20),
  };
}

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({
      source: "demo",
      configured: false,
      ...summarize(DEMO_EVIDENCE),
    });
  }

  try {
    const rows = await db.evaluationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const evidenceRows: EvidenceRow[] = rows.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      task: row.task,
      status: row.status,
      selectedModel: row.selectedModel,
      ...deriveMetadata(row),
      quality: row.quality,
      latencyMs: row.latencyMs,
      costUsd: row.cost,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      source: "database",
      configured: true,
      ...summarize(evidenceRows),
    });
  } catch (err) {
    return NextResponse.json({
      source: "error",
      configured: true,
      error: err instanceof Error ? err.message : String(err),
      ...summarize(DEMO_EVIDENCE),
    }, { status: 200 });
  }
}
