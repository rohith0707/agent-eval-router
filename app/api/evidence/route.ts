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
};

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
  for (const r of rows) {
    providerMix[r.provider] = (providerMix[r.provider] ?? 0) + 1;
    categoryMix[r.category] = (categoryMix[r.category] ?? 0) + 1;
    strategyMix[r.strategy] = (strategyMix[r.strategy] ?? 0) + 1;
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
    const rows = (await db.evaluationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    })) as Array<Omit<EvidenceRow, "id"> & { id: string }>;
    const evidenceRows: EvidenceRow[] = rows.map((r) => ({
      id: r.id,
      externalId: r.externalId,
      task: r.task,
      status: r.status,
      selectedModel: r.selectedModel,
      provider: (r as unknown as { provider?: string }).provider ?? "unknown",
      category: (r as unknown as { category?: string }).category ?? "general",
      strategy: (r as unknown as { strategy?: string }).strategy ?? "adaptive",
      quality: r.quality,
      latencyMs: r.latencyMs,
      costUsd: r.costUsd,
      createdAt: r.createdAt.toISOString(),
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
