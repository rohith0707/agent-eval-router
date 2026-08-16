"use client";
import { useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";

type Result = any;

export default function LiveEvaluation() {
  const [task, setTask] = useState("Analyze a production RAG system and explain three concrete reliability controls.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/live-evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`Evaluation API returned an invalid response (${response.status}).`); }
      if (!response.ok) throw new Error(data.error || "Evaluation failed. Please try again.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Evaluation failed. Please try again."); }
    finally { setLoading(false); }
  }

  return <DashboardShell title="Live Evaluation" eyebrow="Evidence" action={<Link href="/" className="button secondary">Back to dashboard</Link>}>
    <section className="heroCard"><div><p className="eyebrow">LIVE EVIDENCE MODE</p><h2 className="heroTitle">Evaluate a real task through the model cascade.</h2><p className="heroDesc">The router selects internal candidates in priority order, falls through silently on provider/model failure, grades the successful response, and persists the evidence when Neon is available.</p></div></section>
    <section className="card" style={{marginTop:18}}><label className="fieldLabel">Task</label><textarea value={task} onChange={e=>setTask(e.target.value)} rows={5} className="textarea"/><div className="formBar"><span className="helper">No model or provider selection is required.</span><button onClick={run} disabled={loading||!task.trim()} className="button">{loading?"Running evaluation…":"Run evaluation"}</button></div>{error&&<div className="notice errorNotice">{error}</div>}</section>
    {result&&<div className="resultStack"><section className="grid4"><Metric label="Selected model" value={result.decision?.selectedModel ?? "—"} sub={result.provider ?? "—"}/><Metric label="Quality" value={result.metrics?.quality==null?"—":`${(result.metrics.quality*100).toFixed(1)}%`} sub="Deterministic rubric score"/><Metric label="Latency" value={result.metrics?.latencyMs?`${result.metrics.latencyMs}ms`:"—"} sub={`${result.metrics?.fallbackCount??0} internal fallback(s)`}/><Metric label="Persistence" value={result.persisted?"Saved":"Not saved"} sub={result.runId ?? "—"}/></section><section className="grid2"><div className="card"><h2 className="sectionTitle">Routing decision</h2><p className="sectionSub">Why the router accepted the selected candidate</p><p className="bodyText">{result.decision?.reason}</p></div><div className="card"><h2 className="sectionTitle">Model output</h2><pre className="outputBlock">{result.candidates?.[0]?.output || "No output"}</pre></div></section><section className="card"><div className="topRow"><div><h2 className="sectionTitle">Execution trace</h2><p className="sectionSub">Internal failures are not exposed as provider error dumps.</p></div><span className="pill">{result.runId}</span></div><div className="trace">{result.trace?.map((t:any,i:number)=><div className="traceItem" key={`${t.step}-${i}`}><div className="traceMarker">{t.status === "complete" ? "✓" : "•"}</div><div><div className="traceTitle">{t.step}</div><div className="traceDetail">{t.detail}</div></div></div>)}</div></section></div>}
  </DashboardShell>;
}
function Metric({label,value,sub}:{label:string,value:any,sub:string}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue compact">{value}</div><div className="metricDelta">{sub}</div></div>}
