import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { average, p95, rate } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emptySummary = {
  count: 0,
  avgQuality: null as number | null,
  p95LatencyMs: null as number | null,
  passRate: null as number | null,
};

type RunRow = {
  externalId: string;
  task: string;
  status: string;
  selectedModel: string;
  quality: number;
  latencyMs: number;
  createdAt: Date;
  traceJson: unknown;
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
        traceJson: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }) as RunRow[];

    const passed = runs.reduce((count: number, run: RunRow) => count + (run.status === "passed" ? 1 : 0), 0);

    return NextResponse.json({
      runs,
      summary: {
        count: runs.length,
        avgQuality: average(runs.map((run: RunRow) => run.quality)),
        p95LatencyMs: p95(runs.map((run: RunRow) => run.latencyMs)),
        passRate: rate(passed, runs.length),
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
