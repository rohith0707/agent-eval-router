import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emptySummary = {
  count: 0,
  avgQuality: null as number | null,
  p95LatencyMs: null as number | null,
  passRate: null as number | null,
};

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({
      runs: [],
      summary: emptySummary,
      databaseConnected: false,
      warning: "Persistence is not configured. Add DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL from Neon) to the Vercel Production environment and redeploy.",
    });
  }

  try {
    const runs = await db.evaluationRun.findMany({
      select: {
        externalId: true,
        task: true,
        status: true,
        selectedModel: true,
        quality: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const avg = runs.length
      ? runs.reduce((sum, run) => sum + run.quality, 0) / runs.length
      : null;
    const latencies = runs
      .map(run => run.latencyMs)
      .filter(latency => latency > 0)
      .sort((a, b) => a - b);
    const p95 = latencies.length
      ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)]
      : null;
    const passed = runs.reduce((count, run) => count + (run.status === "passed" ? 1 : 0), 0);

    return NextResponse.json({
      runs,
      summary: {
        count: runs.length,
        avgQuality: avg,
        p95LatencyMs: p95,
        passRate: runs.length ? passed / runs.length : null,
      },
      databaseConnected: true,
    });
  } catch (error) {
    console.error("Runs query failed", error);
    return NextResponse.json({
      runs: [],
      summary: emptySummary,
      databaseConnected: false,
      warning: "Database credentials are present but the database cannot be queried. Check the Neon connection string and ensure the EvaluationRun table exists.",
    }, { status: 503 });
  }
}
