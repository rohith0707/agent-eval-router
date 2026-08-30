/**
 * /api/persistence
 * Writes evaluation evidence using the canonical EvaluationRun Prisma schema.
 * Provider/category/strategy belong in trace/candidates JSON; costUsd maps to cost.
 */
import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({
      persisted: false,
      reason: "database_not_configured",
      message: "Set DATABASE_URL or POSTGRES_* env vars.",
    }, { status: 200 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.externalId || !body.task || !body.selectedModel) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const cost = typeof body.costUsd === "number"
    ? body.costUsd
    : typeof body.cost === "number"
      ? body.cost
      : 0;

  const candidatesJson = body.candidatesJson ?? {
    provider: typeof body.provider === "string" ? body.provider : "unknown",
    category: typeof body.category === "string" ? body.category : "general",
    strategy: typeof body.strategy === "string" ? body.strategy : "adaptive",
  };

  const traceJson = body.traceJson ?? {};

  try {
    const run = await db.evaluationRun.upsert({
      where: { externalId: String(body.externalId) },
      update: {
        status: String(body.status ?? "pending"),
        quality: typeof body.quality === "number" ? body.quality : 0,
        latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : 0,
        cost,
        traceJson: isObject(traceJson) || Array.isArray(traceJson) ? traceJson as object : {},
        candidatesJson: isObject(candidatesJson) || Array.isArray(candidatesJson) ? candidatesJson as object : {},
      },
      create: {
        externalId: String(body.externalId),
        task: String(body.task),
        status: String(body.status ?? "pending"),
        selectedModel: String(body.selectedModel),
        quality: typeof body.quality === "number" ? body.quality : 0,
        latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : 0,
        cost,
        reliability: typeof body.reliability === "number" ? body.reliability : (typeof body.quality === "number" ? body.quality : 0),
        reason: typeof body.reason === "string" ? body.reason : "Direct persistence",
        candidatesJson: isObject(candidatesJson) || Array.isArray(candidatesJson) ? candidatesJson as object : {},
        traceJson: isObject(traceJson) || Array.isArray(traceJson) ? traceJson as object : {},
      },
    });

    return NextResponse.json({ persisted: true, run });
  } catch (err) {
    return NextResponse.json({
      persisted: false,
      reason: "database_error",
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({ configured: false, message: "DB not configured." });
  }

  try {
    const count = await db.evaluationRun.count();
    const recent = await db.evaluationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        externalId: true,
        selectedModel: true,
        status: true,
        quality: true,
        latencyMs: true,
        cost: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ configured: true, count, recent });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
