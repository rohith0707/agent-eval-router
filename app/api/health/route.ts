import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
import { configuredProviders, modelRegistry } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseIsConfigured = databaseConfigured();
  let databaseReachable = false;

  if (databaseIsConfigured) {
    try {
      await db.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }

  const providers = configuredProviders();
  const configuredProviderCount = Object.values(providers).filter(Boolean).length;
  const modelCount = Object.values(modelRegistry()).reduce((sum, models) => sum + models.length, 0);

  const ready = databaseIsConfigured && databaseReachable && configuredProviderCount > 0;

  return NextResponse.json(
    {
      ok: ready,
      service: "agent-eval-router",
      checks: {
        databaseConfigured: databaseIsConfigured,
        databaseReachable,
        providers,
        configuredProviderCount,
        internalModelCount: modelCount,
      },
      nextStep: ready
        ? "Runtime configuration is complete."
        : databaseIsConfigured && !databaseReachable
          ? "Database credentials exist but the database is unreachable."
          : configuredProviderCount === 0
            ? "Configure at least one provider API key in Vercel Production."
            : "Configure database persistence in Vercel Production.",
    },
    { status: ready ? 200 : 503 },
  );
}
