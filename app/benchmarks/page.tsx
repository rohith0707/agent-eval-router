"use client";

import DashboardShell from "@/app/components/DashboardShell";
import { useMemo, useState } from "react";

type CategoryResult = { cases: number; passed: number; infraFailed: number; quality: number };
type BenchmarkResult = {
  summary: { passed: number; failed: number; infraFailed: number; averageQuality: number; p95LatencyMs: number | null; fallbackRate: number; persisted: number };
  durationMs: number;
  byCategory: Record<string, CategoryResult>;
  failures?: Array<{ id: string; category: string; status: string; attempts: Array<{ provider: string; model: string; outcome: string; latencyMs: number }> }>;
};

const categories = [["Reasoning",5],["Structured output",5],["Tool calling",5],["RAG",5],["Agent planning",5],["Reliability",5],["Text-to-SQL",5],["Safety / injection",5],["Code generation",5],["Regression",5]] as const;

export default function Benchmarks() {
  const [running,setRunning]=useState(false); const [result,setResult]=useState<BenchmarkResult|null>(null); const [error,setError]=useState("");
  async function run(){
    setRunning(true); setError(""); setResult(null);
    try{
      const response=await fetch("/api/benchmark",{method:"POST"}); const body=await response.json();
      if(!response.ok){const detail=body.smoke?.attempts?.map((a:{provider:string;model:string;outcome:string})=>`${a.provider}/${a.model}: ${a.outcome}`).join(" · "); throw new Error(detail?`${body.error} ${detail}`:body.error||"Benchmark failed");}
      setResult(body as BenchmarkResult);
    }catch(cause){setError(cause instanceof Error?cause.message:"Benchmark failed");}finally{setRunning(false);}
  }
  const decision=useMemo(()=>{
    if(!result) return null;
    const total=result.summary.passed+result.summary.failed+result.summary.infraFailed; const evaluated=Math.max(0,total-result.summary.infraFailed); const passRate=evaluated?result.summary.passed/evaluated:0;
    if(result.summary.infraFailed>0) return {label:"Action required",detail:`${result.summary.infraFailed} of ${total} cases were not evaluated because of provider/infrastructure failures.`,tone:"warning"};
    if(passRate<0.8) return {label:"Needs improvement",detail:`Only ${(passRate*100).toFixed(1)}% of evaluated cases passed the task-specific criteria.`,tone:"warning"};
    return {label:"Healthy",detail:`The routing policy passed ${(passRate*100).toFixed(1)}% of evaluated cases with no infrastructure failures.`,tone:"success"};
  },[result]);

  return <DashboardShell title="50-Case Benchmark" eyebrow="Evaluation" action={<button onClick={run} disabled={running} className="button">{running?"Running 50 cases…":"Run 50 cases"}</button>}>
    {error&&<div className="notice">{error}</div>}
    <div className="pageIntro"><div><div className="eyebrow">Fixed regression suite</div><h2 className="pageTitle">One benchmark. Fifty production-style cases.</h2><p className="pageDesc">Measure model quality separately from provider reliability so timeouts and rate limits never masquerade as bad model scores.</p></div></div>

    <section className="grid4"><Metric label="Cases" value="50" sub="Project-owned test cases"/><Metric label="Categories" value="10" sub="5 cases each"/><Metric label="Baselines" value="3" sub="Single / cheapest / fastest"/><Metric label="Latest status" value={result?"Completed":"Not run"} sub={result?`${result.summary.passed}/50 passed`:"No fabricated results"}/></section>

    {result&&<>
      <section className="grid4" style={{marginTop:14}}>
        <Metric label="Evaluated" value={`${result.summary.passed+result.summary.failed}`} sub="Usable model responses"/>
        <Metric label="Pass rate" value={`${((result.summary.passed/Math.max(1,result.summary.passed+result.summary.failed))*100).toFixed(1)}%`} sub="Passed / evaluated"/>
        <Metric label="Quality" value={`${(result.summary.averageQuality*100).toFixed(1)}%`} sub="Evaluated responses only"/>
        <Metric label="Infra failures" value={`${result.summary.infraFailed}`} sub="Excluded from model quality"/>
      </section>
      {decision&&<section className="card" style={{marginTop:18,borderColor:decision.tone==="warning"?"rgba(234,179,8,.35)":"rgba(34,197,94,.35)"}}><div className="topRow"><div><div className="eyebrow">Decision summary</div><h2 className="sectionTitle" style={{marginBottom:6}}>{decision.label}</h2><p className="sectionSub">{decision.detail}</p></div><span className="pill">{result.summary.persisted} persisted</span></div><div className="policyGrid" style={{marginTop:16}}><div><b>p95 latency</b><span>{result.summary.p95LatencyMs?`${result.summary.p95LatencyMs}ms`:"—"}</span></div><div><b>Fallback rate</b><span>{(result.summary.fallbackRate*100).toFixed(1)}%</span></div><div><b>Infra rate</b><span>{((result.summary.infraFailed/Math.max(1,result.summary.passed+result.summary.failed+result.summary.infraFailed))*100).toFixed(1)}%</span></div><div><b>Run duration</b><span>{result.durationMs}ms</span></div></div></section>}
    </>}

    <section className="grid2" style={{marginTop:18}}><div className="card"><h2 className="sectionTitle">What this benchmark answers</h2><div className="listBlock"><Row title="Quality" text="Does the selected model solve the task correctly?"/><Row title="Reliability" text="Does the router recover when the preferred model fails?"/><Row title="Latency" text="Can the system meet a bounded response budget?"/><Row title="Routing" text="Does adaptive routing beat fixed-model baselines?"/></div></div><div className="card"><h2 className="sectionTitle">Coverage</h2><div className="coverage">{categories.map(([name,count])=><div className="coverageRow" key={name}><span>{name}</span><span className="pill">{count} cases</span></div>)}</div></div></section>

    {result&&<section className="card" style={{marginTop:18}}><div className="topRow"><div><h2 className="sectionTitle">Category performance</h2><p className="sectionSub">Pass rate is the primary outcome metric. Quality is a secondary signal over evaluated responses only.</p></div><span className="pill">{result.durationMs}ms total</span></div><table className="table"><thead><tr><th>Category</th><th>Cases</th><th>Evaluated</th><th>Passed</th><th>Pass rate</th><th>Infra</th><th>Quality</th></tr></thead><tbody>{Object.entries(result.byCategory).map(([key,value])=>{const evaluated=Math.max(0,value.cases-value.infraFailed);const passRate=evaluated?value.passed/evaluated:0;return <tr key={key}><td>{key}</td><td>{value.cases}</td><td>{evaluated}</td><td>{value.passed}</td><td><strong>{evaluated?`${(passRate*100).toFixed(1)}%`:"—"}</strong></td><td>{value.infraFailed||"—"}</td><td>{evaluated?`${(value.quality*100).toFixed(1)}%`:"—"}</td></tr>})}</tbody></table></section>}

    {result?.failures?.length?<section className="card" style={{marginTop:18}}><h2 className="sectionTitle">Failure diagnostics</h2><p className="sectionSub">Operational failures are routing evidence, not model-quality scores.</p><div className="listBlock">{result.failures.slice(0,10).map(f=><div className="listRow" key={f.id}><div className="listTitle">{f.id} · {f.category}</div><div className="sectionSub">{f.attempts.map(a=>`${a.provider}/${a.model}: ${a.outcome} (${a.latencyMs}ms)`).join(" · ")}</div></div>)}</div></section>:null}

    <section className="card" style={{marginTop:18}}><h2 className="sectionTitle">Benchmark policy</h2><p className="sectionSub">The suite stays fixed so routing/model changes are comparable. No external benchmark scores are copied into the product.</p><div className="policyGrid"><div><b>Baseline</b><span>Single-model routing</span></div><div><b>Baseline</b><span>Cheapest model</span></div><div><b>Baseline</b><span>Fastest model</span></div><div><b>Objective</b><span>Quality under latency, cost and reliability constraints</span></div></div></section>
  </DashboardShell>;
}
function Metric({label,value,sub}:{label:string;value:string;sub:string}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricDelta">{sub}</div></div>}
function Row({title,text}:{title:string;text:string}){return <div className="listRow"><div className="listTitle">{title}</div><div className="sectionSub">{text}</div></div>}
