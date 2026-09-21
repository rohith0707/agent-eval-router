export type BenchmarkObservation = { caseId:string; category:string; model:string; passed:boolean; quality:number; latencyMs:number; costUsd:number; fallback:boolean; };
export type BenchmarkModelSummary = { model:string; cases:number; taskSuccess:number; quality:number; routingScore:number; p95LatencyMs:number; costPerTaskUsd:number; reliability:number; failureRate:number; fallbackRate:number; };
function percentile(values:number[],p:number){const s=[...values].sort((a,b)=>a-b);return s.length?s[Math.min(s.length-1,Math.ceil(s.length*p)-1)]:0;}
export function routingScore(input:{quality:number;latencyMs:number;costUsd:number;maxLatencyMs?:number;maxCostUsd?:number}){
 const latencyFit=Math.max(0,Math.min(1,1-input.latencyMs/Math.max(1,input.maxLatencyMs??5000)));
 const costFit=Math.max(0,Math.min(1,1-input.costUsd/Math.max(.000001,input.maxCostUsd??.02)));
 return Number((.65*input.quality+.20*latencyFit+.15*costFit).toFixed(3));
}
export function summarizeBenchmark(observations:BenchmarkObservation[]):BenchmarkModelSummary[]{
 if(!observations.length) throw new Error("Benchmark requires at least one observation");
 return [...new Set(observations.map(o=>o.model))].map(model=>{
  const rows=observations.filter(o=>o.model===model),passed=rows.filter(o=>o.passed).length;
  return {model,cases:rows.length,taskSuccess:passed/rows.length,quality:rows.reduce((s,o)=>s+o.quality,0)/rows.length,routingScore:rows.reduce((s,o)=>s+routingScore({quality:o.quality,latencyMs:o.latencyMs,costUsd:o.costUsd}),0)/rows.length,p95LatencyMs:percentile(rows.map(o=>o.latencyMs),.95),costPerTaskUsd:rows.reduce((s,o)=>s+o.costUsd,0)/rows.length,reliability:(rows.length-rows.filter(o=>o.fallback).length)/rows.length,failureRate:(rows.length-passed)/rows.length,fallbackRate:rows.filter(o=>o.fallback).length/rows.length};
 });
}
