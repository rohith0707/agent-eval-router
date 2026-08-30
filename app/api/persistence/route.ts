/**
 * /api/persistence
 *
 * Day 4: Live evidence persistence endpoint.
 * Persists evaluation run results to PostgreSQL when configured;
 * returns a structured "not_configured" response otherwise.
 */

import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PersistencePayload = {
  externalId: string;
  task: string;
  status: string;
  selectedModel: string;
  provider: string;
  quality: number;
  latencyMs: number;
  costUsd: number;
  category?: string;
  strategy?: string;
  traceJson?: unknown;
};

export async function POST(req: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json(
      {
        persisted: false,
        reason: "database_not_configured",
        message:
          "Set DATABASE_URL or POSTGRES_* env vars to enable persistence. " +
          "Demo data is available via the seed script.",
      },
      { status: 200 }
    );
  }

  let body: PersistencePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.externalId || !body.task || !body.selectedModel) {
    return NextResponse.json(
      { error: "Missing required fields: externalId, task, selectedModel" },
      { status: 400 }
    );
  }

  try {
    const run = await db.evaluationRun.upsert({
      where: { externalId: body.externalId },
      update: {
        status: body.status,
        quality: body.quality,
        latencyMs: body.latencyMs,
        costUsd: body.costUsd,
        traceJson: (body.traceJson ?? {}) as object,
      },
      create: {
        externalId: body.externalId,
        task: body.task,
        status: body.status,
        selectedModel: body.selectedModel,
        provider: body.provider,
        category: body.category ?? "general",
        strategy: body.strategy ?? "adaptive",
        quality: body.quality,
        latencyMs: body.latencyMs,
        costUsd: body.costUsd,
        traceJson: (body.traceJson ?? {}) as object,
      },
    });
    return NextResponse.json({ persisted: true, run });
  } catch (err) {
    return NextResponse.json(
      {
        persisted: false,
        reason: "database_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!databaseConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "No database configured. Evidence will be in-memory only.",
    });
  }
  try {
    const count = await db.evaluationRun.count();
    const recent = await db.evaluationRun.findMany({
      select: {
        externalId: true,
        selectedModel: true,
        status: true,
        quality: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json({ configured: true, count, recent });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
