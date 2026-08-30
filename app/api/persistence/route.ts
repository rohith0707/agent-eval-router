/**
 * /api/persistence — Day 4 persistence route
 * Fixed Prisma EvaluationRun upsert type (update vs create types).
 */
import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({
      persisted: false,
      reason: "database_not_configured",
      message: "Set DATABASE_URL or POSTGRES_* env vars.",
    }, { status: 200 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.externalId || !body.task || !body.selectedModel) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  try {
    const run = await db.evaluationRun.upsert({
      where: { externalId: String(body.externalId) },
      update: {
        status: String(body.status ?? "pending"),
        quality: typeof body.quality === "number" ? body.quality : 0,
        latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : 0,
        costUsd: typeof body.costUsd === "number" ? body.costUsd : 0,
        traceJson: (body.traceJson ?? {}) as object,
      },
      create: {
        externalId: String(body.externalId),
        task: String(body.task),
        status: String(body.status ?? "pending"),
        selectedModel: String(body.selectedModel),
        provider: String(body.provider ?? "unknown"),
        category: String(body.category ?? "general"),
        strategy: String(body.strategy ?? "adaptive"),
        quality: typeof body.quality === "number" ? body.quality : 0,
        latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : 0,
        cost: typeof body.costUsd === "number" ? body.costUsd : 0,
        reliability: typeof body.quality === "number" ? body.quality : 0,
        reason: "Direct persistence",
        costUsd: typeof body.costUsd === "number" ? body.costUsd : 0,
        candidatesJson: {},
        traceJson: (body.traceJson ?? {}) as object,
      },
    });
    return NextResponse.json({ persisted: true, run });
  } catch (err) {
    return NextResponse.json({ persisted: false, reason: "database_error", message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET() {
  if (!databaseConfigured()) return NextResponse.json({ configured: false, message: "DB not configured." });
  try {
    const count = await db.evaluationRun.count();
    const recent = await db.evaluationRun.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { externalId: true, selectedModel: true, status: true, quality: true, latencyMs: true, createdAt: true } });
    return NextResponse.json({ configured: true, count, recent });
  } catch (err) {
    return NextResponse.json({ configured: true, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
