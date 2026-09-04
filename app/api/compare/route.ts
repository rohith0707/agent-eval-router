import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Profile = {
  sha: string;
  count: number;
  averageQuality: number;
  averageLatencyMs: number;
  totalCostUsd: number;
  passedCount: number;
  passRate: number;
  modelMix: Record<string, number>;
  providerMix: Record<string, number>;
};

function summarizeRuns(sha: string, rows: Array<Record<string, unknown>>): Profile {
  const count = rows.length;
  if (!count) {
    return {
      sha,
      count: 0,
      averageQuality: 0,
      averageLatencyMs: 0,
      totalCostUsd: 0,
      passedCount: 0,
      passRate: 0,
      modelMix: {},
      providerMix: {},
    };
  }

  const passed = rows.filter((r) => r.status === "passed");
  const qualitySum = rows.reduce((acc, r) => acc + (typeof r.quality === "number" ? r.quality : 0), 0);
  const latencyRows = rows.filter((r) => typeof r.latencyMs === "number" && r.latencyMs > 0);
  const latencySum = latencyRows.reduce((acc, r) => acc + (r.latencyMs as number), 0);
  const costSum = rows.reduce((acc, r) => {
    const cost = typeof r.costUsd === "number" ? r.costUsd : typeof r.cost === "number" ? r.cost : 0;
    return acc + cost;
  }, 0);

  const modelMix: Record<string, number> = {};
  const providerMix: Record<string, number> = {};
  for (const r of rows) {
    const model = String(r.selectedModel ?? "unknown");
    const provider = String(r.provider ?? "unknown");
    modelMix[model] = (modelMix[model] ?? 0) + 1;
    providerMix[provider] = (providerMix[provider] ?? 0) + 1;
  }

  return {
    sha,
    count,
    averageQuality: Number((qualitySum / count).toFixed(3)),
    averageLatencyMs: latencyRows.length ? Math.round(latencySum / latencyRows.length) : 0,
    totalCostUsd: Number(costSum.toFixed(6)),
    passedCount: passed.length,
    passRate: Number((passed.length / count).toFixed(3)),
    modelMix,
    providerMix,
  };
}

export async function GET(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const baselineSha = url.searchParams.get("baseline") ?? "previous";
    const headSha = url.searchParams.get("head") ?? "current";

    // When literal shas are not supplied, compare the most recent 50 runs vs previous 50
    let baselineRows: Array<Record<string, unknown>> = [];
    let headRows: Array<Record<string, unknown>> = [];

    if (baselineSha !== "previous" && headSha !== "current") {
      [baselineRows, headRows] = await Promise.all([
        db.evaluationRun.findMany({
          where: { commitSha: baselineSha },
          orderBy: { createdAt: "desc" },
          take: 50,
        }) as Promise<Array<Record<string, unknown>>>,
        db.evaluationRun.findMany({
          where: { commitSha: headSha },
          orderBy: { createdAt: "desc" },
          take: 50,
        }) as Promise<Array<Record<string, unknown>>>,
      ]);
    } else {
      const recent = (await db.evaluationRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      })) as Array<Record<string, unknown>>;
      headRows = recent.slice(0, 50);
      baselineRows = recent.slice(50, 100);
    }

    const baseline = summarizeRuns(baselineSha, baselineRows);
    const head = summarizeRuns(headSha, headRows);

    const delta = {
      quality: Number((head.averageQuality - baseline.averageQuality).toFixed(3)),
      qualityPct: baseline.averageQuality > 0
        ? Number((((head.averageQuality - baseline.averageQuality) / baseline.averageQuality) * 100).toFixed(1))
        : 0,
      latencyMs: head.averageLatencyMs - baseline.averageLatencyMs,
      latencyPct: baseline.averageLatencyMs > 0
        ? Number((((head.averageLatencyMs - baseline.averageLatencyMs) / baseline.averageLatencyMs) * 100).toFixed(1))
        : 0,
      costUsd: Number((head.totalCostUsd - baseline.totalCostUsd).toFixed(6)),
      costPct: baseline.totalCostUsd > 0
        ? Number((((head.totalCostUsd - baseline.totalCostUsd) / baseline.totalCostUsd) * 100).toFixed(1))
        : 0,
      passRate: Number((head.passRate - baseline.passRate).toFixed(3)),
    };

    // Verdict gate:
    // SHIP: quality unchanged or up, cost <= +10%, latency <= +20%
    // BLOCK: quality down > 3%, cost up > 50%, latency up > 50%
    // REVIEW: anything in between
    let verdict: "SHIP" | "REVIEW" | "BLOCK" = "SHIP";
    const reasons: string[] = [];

    if (delta.quality < -0.03) {
      verdict = "BLOCK";
      reasons.push(`Quality degraded by ${(Math.abs(delta.quality) * 100).toFixed(1)}%`);
    }
    if (delta.costPct > 50) {
      verdict = "BLOCK";
      reasons.push(`Cost increased by ${delta.costPct}%`);
    }
    if (delta.latencyPct > 50) {
      verdict = "BLOCK";
      reasons.push(`Latency regressed by ${delta.latencyPct}%`);
    }

    if (verdict !== "BLOCK") {
      if (delta.quality < 0) {
        verdict = "REVIEW";
        reasons.push(`Minor quality drop (${(Math.abs(delta.quality) * 100).toFixed(1)}%)`);
      }
      if (delta.costPct > 10) {
        verdict = "REVIEW";
        reasons.push(`Cost increased by ${delta.costPct}%`);
      }
      if (delta.latencyPct > 20) {
        verdict = "REVIEW";
        reasons.push(`Latency increased by ${delta.latencyPct}%`);
      }
    }

    if (verdict === "SHIP" && reasons.length === 0) {
      reasons.push("All quality, cost, and latency gates satisfied");
    }

    return NextResponse.json({
      verdict,
      reasons,
      baseline,
      head,
      delta,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Compare evaluation failed", message: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
