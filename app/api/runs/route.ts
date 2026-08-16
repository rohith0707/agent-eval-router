import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await db.evaluationRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    const real = runs.filter(r => r.quality >= 0);
    const avgQuality = real.length ? real.reduce((s, r) => s + r.quality, 0) / real.length : null;
    const latencies = real.map(r => r.latencyMs).filter(n => n > 0).sort((a,b) => a-b);
    const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * .95) - 1)] : null;
    const passed = real.filter(r => r.status === "passed").length;
    return NextResponse.json({ runs, summary: { count: real.length, avgQuality, p95LatencyMs: p95, passRate: real.length ? passed / real.length : null } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load runs" }, { status: 500 });
  }
}
