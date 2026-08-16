import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(){
  try{
    const runs=await db.evaluationRun.findMany({orderBy:{createdAt:"desc"},take:50});
    const avg=runs.length?runs.reduce((s,r)=>s+r.quality,0)/runs.length:null;
    const ls=runs.map(r=>r.latencyMs).filter(n=>n>0).sort((a,b)=>a-b);
    const p95=ls.length?ls[Math.min(ls.length-1,Math.ceil(ls.length*.95)-1)]:null;
    const passed=runs.filter(r=>r.status==="passed").length;
    return NextResponse.json({runs,summary:{count:runs.length,avgQuality:avg,p95LatencyMs:p95,passRate:runs.length?passed/runs.length:null},databaseConnected:true});
  }catch{
    // The dashboard must remain usable when persistence is not configured.
    // Never expose DATABASE_URL, Prisma stack traces, or infrastructure secrets.
    return NextResponse.json({runs:[],summary:{count:0,avgQuality:null,p95LatencyMs:null,passRate:null},databaseConnected:false,warning:"Persistence is not configured. Add DATABASE_URL to enable saved evaluation evidence."});
  }
}
