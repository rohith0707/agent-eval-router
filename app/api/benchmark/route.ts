import {NextResponse} from "next/server";
import {promises as fs} from "fs";
import path from "path";
import {db,databaseConfigured} from "@/lib/db";
import {deterministicGrade,runProviderCascade} from "@/lib/providers";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const BENCHMARK_ATTEMPT_TIMEOUT_MS = 1400;
const BENCHMARK_CASE_DEADLINE_MS = 5000;
const BENCHMARK_CONCURRENCY = 10;
const BENCHMARK_MAX_MODELS_PER_PROVIDER = 1;

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
  const cases=raw.trim().split("\n").filter(Boolean).map(line=>JSON.parse(line));
  if(cases.length!==50) return NextResponse.json({error:"Benchmark suite must contain exactly 50 cases."},{status:500});

  const started=performance.now();
  const results=await mapWithConcurrency(cases,BENCHMARK_CONCURRENCY,async(c:any)=>{
   const cascade=await runProviderCascade([
    {role:"system",content:"You are being evaluated on a fixed production benchmark. Follow the task exactly. Be concise and do not invent facts."},
    {role:"user",content:c.task},
   ],120,{
     attemptTimeoutMs:BENCHMARK_ATTEMPT_TIMEOUT_MS,
     totalDeadlineMs:BENCHMARK_CASE_DEADLINE_MS,
     maxModelsPerProvider:BENCHMARK_MAX_MODELS_PER_PROVIDER,
   });
   if(!cascade.result){
    return {id:c.id,category:c.category,status:"failed",quality:0,latencyMs:null,provider:null,model:null,fallbacks:cascade.attempts.length,attempts:cascade.attempts};
   }
   const quality=scoreBenchmark(c.task,c.expected_behavior,cascade.result.output);
   return {id:c.id,category:c.category,status:"passed",quality,latencyMs:cascade.result.latencyMs,provider:cascade.result.provider,model:cascade.result.model,fallbacks:cascade.attempts.filter(a=>a.outcome!=="success").length,attempts:cascade.attempts,output:cascade.result.output};
  });

  let persisted=0;
  if(databaseConfigured()){
   for(const r of results){
    try{
     await db.evaluationRun.create({data:{
      externalId:`bench_${Date.now()}_${r.id}`,
      task:r.id,
      status:r.status,
      selectedModel:r.model ?? "unresolved",
      reason:`50-case benchmark · ${r.category}`,
      quality:r.quality,
      latencyMs:r.latencyMs ?? 0,
      cost:0,
      reliability:r.status==="passed"?1:0,
      candidatesJson:r.attempts,
      traceJson:[{step:"Benchmark case",status:r.status,detail:r.id},{step:"Provider cascade",status:r.status,detail:r.model?`${r.provider} / ${r.model}`:"No candidate succeeded"}],
     }});
     persisted++;
    }catch{}
   }
  }

  const passed=results.filter(r=>r.status==="passed");
  const failed=results.filter(r=>r.status!=="passed");
  const latencies=passed.map(r=>r.latencyMs??0).sort((a,b)=>a-b);
  const p95=latencies.length?latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*0.95)-1)]:null;
  const avgQuality=passed.length?passed.reduce((s,r)=>s+r.quality,0)/passed.length:0;
  const fallbackRate=results.length?results.filter(r=>r.fallbacks>0).length/results.length:0;
  const providerMix=Object.fromEntries([...new Set(results.map(r=>r.provider).filter(Boolean))].map(p=>[p,results.filter(r=>r.provider===p).length]));

  return NextResponse.json({
   suite:{name:"routing-bench-v1",cases:50},
   durationMs:Math.round(performance.now()-started),
   summary:{passed:passed.length,failed:failed.length,averageQuality:Number(avgQuality.toFixed(3)),p95LatencyMs:p95,fallbackRate:Number(fallbackRate.toFixed(3)),persisted},
   providerMix,
   byCategory:Object.fromEntries([...new Set(results.map(r=>r.category))].map(cat=>{const xs=results.filter(r=>r.category===cat);return [cat,{cases:xs.length,passed:xs.filter(r=>r.status==="passed").length,quality:Number((xs.reduce((s,r)=>s+r.quality,0)/xs.length).toFixed(3))}]})),
   failures:failed.slice(0,10).map(r=>({id:r.id,category:r.category,attempts:r.attempts})),
  });
 }catch(error){console.error("Benchmark run failed",error);return NextResponse.json({error:"Benchmark could not be completed."},{status:503});}
}
