import {NextResponse} from "next/server";
import {promises as fs} from "fs";
import path from "path";
import {db,databaseConfigured} from "@/lib/db";
import {deterministicGrade,runProviderCascade} from "@/lib/providers";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function scoreBenchmark(task:string,expected:string,output:string){
 const expectedWords=new Set(expected.toLowerCase().split(/[^a-z0-9$]+/).filter(w=>w.length>2));
 const outputWords=new Set(output.toLowerCase().split(/[^a-z0-9$]+/).filter(w=>w.length>2));
 let overlap=0; for(const w of expectedWords) if(outputWords.has(w)) overlap++;
 const overlapScore=expectedWords.size?overlap/expectedWords.size:0;
 const rubric=deterministicGrade(task,output);
 return Number((0.6*overlapScore+0.4*rubric.quality).toFixed(3));
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,worker:(item:T)=>Promise<R>){
 const results:R[]=[]; let next=0;
 async function runner(){while(true){const i=next++; if(i>=items.length) return; results[i]=await worker(items[i]);}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>runner()));
 return results;
}

export async function POST(){
 try{
  const raw=await fs.readFile(path.join(process.cwd(),"benchmarks","routing-bench-v1.jsonl"),"utf8");
  const cases=raw.trim().split("\n").map(line=>JSON.parse(line));
  if(cases.length!==50) return NextResponse.json({error:"Benchmark suite must contain exactly 50 cases."},{status:500});

  const started=performance.now();
  const results=await mapWithConcurrency(cases,5,async(c:any)=>{
   const cascade=await runProviderCascade([
    {role:"system",content:"You are being evaluated on a fixed production benchmark. Follow the task exactly. Be concise and do not invent facts."},
    {role:"user",content:c.task},
   ],140);
   if(!cascade.result) return {id:c.id,category:c.category,status:"failed",quality:0,latencyMs:null,provider:null,model:null,fallbacks:cascade.attempts.length};
   const quality=scoreBenchmark(c.task,c.expected_behavior,cascade.result.output);
   return {id:c.id,category:c.category,status:"passed",quality,latencyMs:cascade.result.latencyMs,provider:cascade.result.provider,model:cascade.result.model,fallbacks:cascade.attempts.filter(a=>a.outcome!=="success").length,output:cascade.result.output};
  });

  let persisted=0;
  if(databaseConfigured()){
   for(const r of results){
    if(r.status!=="passed") continue;
    try{await db.evaluationRun.create({data:{externalId:`bench_${Date.now()}_${r.id}`,task:r.id,status:"passed",selectedModel:r.model ?? "unknown",reason:`50-case benchmark · ${r.category}`,quality:r.quality,latencyMs:r.latencyMs ?? 0,cost:0,reliability:1,candidatesJson:[{provider:r.provider,model:r.model,output:r.output,category:r.category}],traceJson:[{step:"Benchmark case",status:"complete",detail:r.id},{step:"Provider cascade",status:"complete",detail:`${r.provider} / ${r.model}`} ]}});persisted++}catch{}
   }
  }

  const passed=results.filter(r=>r.status==="passed");
  const latencies=passed.map(r=>r.latencyMs??0).sort((a,b)=>a-b);
  const p95=latencies.length?latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*0.95)-1)]:null;
  const avgQuality=passed.length?passed.reduce((s,r)=>s+r.quality,0)/passed.length:0;
  const fallbackRate=passed.length?passed.filter(r=>r.fallbacks>0).length/passed.length:0;

  return NextResponse.json({
   suite:{name:"routing-bench-v1",cases:50},
   durationMs:Math.round(performance.now()-started),
   summary:{passed:passed.length,failed:50-passed.length,averageQuality:Number(avgQuality.toFixed(3)),p95LatencyMs:p95,fallbackRate:Number(fallbackRate.toFixed(3)),persisted},
   byCategory:Object.fromEntries([...new Set(results.map(r=>r.category))].map(cat=>{const xs=results.filter(r=>r.category===cat);return [cat,{cases:xs.length,passed:xs.filter(r=>r.status==="passed").length,quality:Number((xs.reduce((s,r)=>s+r.quality,0)/xs.length).toFixed(3))}] })),
  });
 }catch(error){console.error("Benchmark run failed",error);return NextResponse.json({error:"Benchmark could not be completed."},{status:503});}
}
