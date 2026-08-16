import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  if (!databaseConfigured()) {
    return NextResponse.json({
      runs: [],
      summary: { count: 0, avgQuality: null, p95LatencyMs: null, passRate: null },
      databaseConnected: false,
      warning: "Persistence is not configured. Add DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL from Neon) to the Vercel Production environment and redeploy."
    });
  }

  try{
    const runs=await db.evaluationRun.findMany({orderBy:{createdAt:"desc"},take:50});
    const avg=runs.length?runs.reduce((s,r)=>s+r.quality,0)/runs.length:null;
    const ls=runs.map(r=>r.latencyMs).filter(n=>n>0).sort((a,b)=>a-b);
    const p95=ls.length?ls[Math.min(ls.length-1,Math.ceil(ls.length*.95)-1)]:null;
    const passed=runs.filter(r=>r.status==="passed").length;
    return NextResponse.json({runs,summary:{count:runs.length,avgQuality:avg,p95LatencyMs:p95,passRate:runs.length?passed/runs.length:null},databaseConnected:true});
  }catch{
    return NextResponse.json({
      runs: [],
      summary: { count: 0, avgQuality: null, p95LatencyMs: null, passRate: null },
      databaseConnected: false,
      warning: "Database credentials are present but the database cannot be queried. Check the Neon connection string and ensure the EvaluationRun table exists."
    }, { status: 503 });
  }
}
