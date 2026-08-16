import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { getNvidiaApiKey, getNvidiaModel } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = databaseConfigured();
  let databaseReachable = false;

  if (database) {
    try {
      await db.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  const nvidia = Boolean(getNvidiaApiKey());
  const ready = database && databaseReachable && nvidia;

  return NextResponse.json({
    ok: ready,
    service: "agent-eval-router",
    checks: {
      databaseConfigured: database,
      databaseReachable,
      nvidiaApiKeyConfigured: nvidia,
      nvidiaModel: getNvidiaModel(),
    },
    nextStep: ready
      ? "Runtime configuration is complete."
      : "Set the missing Vercel Production environment variables and redeploy.",
  }, { status: ready ? 200 : 503 });
}
