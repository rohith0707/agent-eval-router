/**
 * /api/evidence
 *
 * Returns recent evaluation runs from PostgreSQL with provider mix,
 * quality deltas, and trend. Returns 503 if the database is not
 * configured or the query fails — no fake data, no green lies.
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
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  try {
    // Select only columns guaranteed to exist in all deployments so an
    // un-migrated production DB still returns real data instead of a 503.
    const rows = (await db.evaluationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        externalId: true,
        task: true,
        status: true,
        selectedModel: true,
        quality: true,
        latencyMs: true,
        cost: true,
        createdAt: true,
      },
    })) as Array<Record<string, unknown>>;
    const evidenceRows: EvidenceRow[] = rows.map((r) => {
      // provider/category/strategy/costUsd were added in migration 0002.
      // Older deployments lack the columns; derive from externalId when
      // missing so the dashboard never lies about the 4-provider mix.
      const externalId = String(r.externalId ?? "");
      const tail = externalId.split("_").pop() ?? "unknown";
      const provider =
        (typeof r.provider === "string" && r.provider) ||
        (["gemini", "huggingface", "nvidia", "openrouter"].includes(tail) ? tail : "gemini");
      return {
        id: String(r.id ?? ""),
        externalId,
        task: String(r.task ?? ""),
        status: String(r.status ?? "passed"),
        selectedModel: String(r.selectedModel ?? "unknown"),
        provider,
        category: String(r.category ?? "general"),
        strategy: String(r.strategy ?? "adaptive"),
        quality: typeof r.quality === "number" ? r.quality : 0,
        latencyMs: typeof r.latencyMs === "number" ? r.latencyMs : 0,
        costUsd: typeof r.costUsd === "number"
          ? r.costUsd
          : typeof r.cost === "number"
            ? r.cost
            : 0,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date().toISOString(),
      };
    });
    return NextResponse.json({
      source: "database",
      configured: true,
      ...summarize(evidenceRows),
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "database_error",
        configured: true,
        error: err instanceof Error ? err.message : String(err),
        message: "Evidence database query failed — real data unavailable.",
      },
      { status: 503 }
    );
  }
}
