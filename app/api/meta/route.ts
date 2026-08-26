import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    environment: process.env.VERCEL_ENV ?? "development",
    deploymentUrl: process.env.VERCEL_URL ?? null,
  });
}
