"use client";
import DashboardShell from "@/app/components/DashboardShell";
import {useState} from "react";

const categories=[
 ["Reasoning",5],["Structured output",5],["Tool calling",5],["RAG",5],["Agent planning",5],["Reliability",5],["Text-to-SQL",5],["Safety / injection",5],["Code generation",5],["Regression",5]
] as const;

export default function Benchmarks(){
 const [running,setRunning]=useState(false); const [result,setResult]=useState<any>(null); const [error,setError]=useState("");
 async function run(){setRunning(true);setError("");setResult(null);try{const r=await fetch("/api/benchmark",{method:"POST"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Benchmark failed");setResult(j)}catch(e){setError(e instanceof Error?e.message:"Benchmark failed")}finally{setRunning(false)}}
 return <DashboardShell title="50-Case Benchmark" eyebrow="Evaluation" action={<button onClick={run} disabled={running} className="button">{running?"Running 50 cases…":"Run 50 cases"}</button>}>
  {error&&<div className="notice">{error}</div>}
  <div className="pageIntro"><div><div className="eyebrow">Fixed regression suite</div><h2 className="pageTitle">One benchmark. Fifty production-style cases.</h2><p className="pageDesc">The same cases are used to compare routing behavior across quality, reliability, latency and safety. Results are persisted when the database is available.</p></div></div>
  <section className="grid4">
   <Metric label="Cases" value="50" sub="Project-owned test cases"/><Metric label="Categories" value="10" sub="5 cases each"/><Metric label="Baselines" value="3" sub="Single / cheapest / fastest"/><Metric label="Latest status" value={result?"Completed":"Not run"} sub={result?`${result.summary.passed}/50 passed`:"No fabricated results"}/>
  </section>
  {result&&<section className="grid4" style={{marginTop:14}}><Metric label="Average quality" value={`${(result.summary.averageQuality*100).toFixed(1)}%`} sub="Automated benchmark rubric"/><Metric label="p95 latency" value={result.summary.p95LatencyMs?`${result.summary.p95LatencyMs}ms`:"—"} sub="Successful routed cases"/><Metric label="Fallback rate" value={`${(result.summary.fallbackRate*100).toFixed(1)}%`} sub="Cases needing recovery"/><Metric label="Persisted" value={`${result.summary.persisted}`} sub="Evidence records stored"/></section>}
  <section className="grid2" style={{marginTop:18}}>
   <div className="card"><h2 className="sectionTitle">What this benchmark answers</h2><div className="listBlock"><Row title="Quality" text="Does the selected model solve the task correctly?"/><Row title="Reliability" text="Does the router recover when the preferred model fails?"/><Row title="Latency" text="Can the system meet a bounded response budget?"/><Row title="Routing" text="Does adaptive routing beat simple fixed-model baselines?"/></div></div>
   <div className="card"><h2 className="sectionTitle">Coverage</h2><div className="coverage">{categories.map(([name,count])=><div className="coverageRow" key={name}><span>{name}</span><span className="pill">{count} cases</span></div>)}</div></div>
  </section>
  {result&&<section className="card" style={{marginTop:18}}><div className="topRow"><div><h2 className="sectionTitle">Category results</h2><p className="sectionSub">Real run output from the current model cascade.</p></div><span className="pill">{result.durationMs}ms total</span></div><table className="table"><thead><tr><th>Category</th><th>Cases</th><th>Passed</th><th>Quality</th></tr></thead><tbody>{Object.entries(result.byCategory).map(([k,v]:any)=><tr key={k}><td>{k}</td><td>{v.cases}</td><td>{v.passed}</td><td>{(v.quality*100).toFixed(1)}%</td></tr>)}</tbody></table></section>}
  <section className="card" style={{marginTop:18}}><h2 className="sectionTitle">Benchmark policy</h2><p className="sectionSub">The suite stays fixed so routing/model changes are comparable. External gated benchmarks remain separate and are never copied into the repository.</p><div className="policyGrid"><div><b>Baseline</b><span>Single-model routing</span></div><div><b>Baseline</b><span>Cheapest model</span></div><div><b>Baseline</b><span>Fastest model</span></div><div><b>Objective</b><span>Quality under latency, cost and reliability constraints</span></div></div></section>
 </DashboardShell>
}
function Metric({label,value,sub}:{label:string,value:string,sub:string}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricDelta">{sub}</div></div>}
function Row({title,text}:{title:string,text:string}){return <div className="listRow"><div className="listTitle">{title}</div><div className="sectionSub">{text}</div></div>}
