/**
 * /api/evidence
 *
 * Day 5: Live evidence endpoint — returns recent evaluation runs
 * from PostgreSQL with provider mix, quality deltas, and trend.
 * Falls back to in-memory demo data if DB is not configured.
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
  evidenceRank?: Array<{
    model: string;
    evidenceRank: number;
    avgQuality: number;
    avgLatencyMs: number;
    costPerQuality: number;
    runs: number;
  }>;
};

const DEMO_EVIDENCE: EvidenceRow[] = Array.from({ length: 100 }, (_, i) => {
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
  const passed = rows.filter((r) => r.status === "passed").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const total = rows.length;
  const averageQuality =
    total > 0 ? rows.reduce((s, r) => s + r.quality, 0) / total : 0;
  const latencies = rows.map((r) => r.latencyMs).filter((n) => Number.isFinite(n));
  const averageLatencyMs =
    latencies.length > 0 ? latencies.reduce((s, n) => s + n, 0) / latencies.length : 0;

  const providerMix: Record<string, number> = {};
  const categoryMix: Record<string, number> = {};
  const strategyMix: Record<string, number> = {};
  // EvidenceRank per model: PageRank-style weighted quality score
  const modelScores: Record<string, { rank: number; avgQuality: number; avgLatencyMs: number; costPerQuality: number; runs: number }> = {};
  for (const r of rows) {
    providerMix[r.provider] = (providerMix[r.provider] ?? 0) + 1;
    categoryMix[r.category] = (categoryMix[r.category] ?? 0) + 1;
    strategyMix[r.strategy] = (strategyMix[r.strategy] ?? 0) + 1;
    if (!modelScores[r.selectedModel]) {
      modelScores[r.selectedModel] = { rank: 0, avgQuality: 0, avgLatencyMs: 0, costPerQuality: 0, runs: 0 };
    }
    const m = modelScores[r.selectedModel];
    m.runs += 1;
    m.avgQuality = (m.avgQuality * (m.runs - 1) + r.quality) / m.runs;
    m.avgLatencyMs = Math.round((m.avgLatencyMs * (m.runs - 1) + r.latencyMs) / m.runs);
    const totalCost = m.costPerQuality * (m.runs - 1) + (r.quality > 0 ? r.costUsd / r.quality : 0);
    m.costPerQuality = Math.round(totalCost / m.runs * 1000000) / 1000000;
  }
  // Compute EvidenceRank = sum(quality × reliability_weight), sorted desc
  const ranked = Object.entries(modelScores)
    .map(([model, s]) => ({
      model,
      evidenceRank: Math.round(s.avgQuality * s.runs * 1000) / 1000,
      avgQuality: Math.round(s.avgQuality * 1000) / 1000,
      avgLatencyMs: s.avgLatencyMs,
      costPerQuality: s.costPerQuality,
      runs: s.runs,
    }))
    .sort((a, b) => b.evidenceRank - a.evidenceRank);

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
    evidenceRank: ranked.slice(0, 5),
  };
}

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json(
      {
        source: "demo",
        configured: false,
        ...summarize(DEMO_EVIDENCE),
      },
    );
  }
  try {
    const rows = (await db.evaluationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    })) as Array<Record<string, unknown>>;
    const evidenceRows: EvidenceRow[] = rows.map((r) => ({
      id: String(r.id ?? ""),
      externalId: String(r.externalId ?? ""),
      task: String(r.task ?? ""),
      status: String(r.status ?? "passed"),
      selectedModel: String(r.selectedModel ?? "unknown"),
      provider: String(r.provider ?? "unknown"),
      category: String(r.category ?? "general"),
      strategy: String(r.strategy ?? "adaptive"),
      quality: typeof r.quality === "number" ? r.quality : 0,
      latencyMs: typeof r.latencyMs === "number" ? r.latencyMs : 0,
      costUsd: typeof r.costUsd === "number" ? r.costUsd : (typeof r.cost === "number" ? r.cost : 0),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date().toISOString(),
    }));
    return NextResponse.json({
      source: "database",
      configured: true,
      ...summarize(evidenceRows),
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "error",
        configured: true,
        error: err instanceof Error ? err.message : String(err),
        ...summarize(DEMO_EVIDENCE),
      },
      { status: 200 }
    );
  }
}
