import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { configuredProviders, modelRegistry } from "@/lib/providers";

const copy: Record<string,{title:string;eyebrow:string;description:string}> = {
  runs:{title:"Evaluation Runs",eyebrow:"Runs",description:"Historical evidence from persisted evaluation executions."},
  benchmarks:{title:"Benchmarks",eyebrow:"Evaluation",description:"Compare models against repeatable datasets and evaluation rubrics."},
  datasets:{title:"Datasets",eyebrow:"Evaluation",description:"Benchmark inputs, task categories, and expected evidence."},
  models:{title:"Model Registry",eyebrow:"Models",description:"Internal catalog of candidate models. Users never configure individual model IDs."},
  performance:{title:"Model Performance",eyebrow:"Models",description:"Quality, latency, reliability, and cost signals by model."},
  routing:{title:"Routing Decisions",eyebrow:"Routing",description:"Evidence-backed decisions showing why a model was selected or bypassed."},
  policies:{title:"Routing Policies",eyebrow:"Routing",description:"Serving and benchmark policies for quality, latency, reliability, and cost."},
  health:{title:"Provider Health",eyebrow:"Reliability",description:"Provider availability and internal health signals without exposing credentials."},
  failures:{title:"Failures",eyebrow:"Reliability",description:"Grouped model/provider failures, fallback behavior, and recovery state."},
  traces:{title:"Execution Traces",eyebrow:"Observability",description:"Step-by-step evidence from request intake through grading and persistence."},
  latency:{title:"Latency",eyebrow:"Observability",description:"p50/p95/p99 latency views by provider, model, and task type."},
  cost:{title:"Cost & Usage",eyebrow:"Observability",description:"Token usage, estimated cost, and cost-aware routing signals."},
  reports:{title:"Reports",eyebrow:"Reporting",description:"Benchmark summaries and shareable evidence for engineering review."},
  settings:{title:"Configuration",eyebrow:"System",description:"Server-side routing thresholds, provider configuration, and persistence state."},
};

export default async function ControlPage({params}:{params:Promise<{slug:string[]}>}){
  const {slug}=await params; const key=slug.at(-1) ?? slug[0] ?? ""; const meta=copy[key] ?? {title:"Control Plane",eyebrow:"System",description:"Operational surface for Agent Eval Router."};
  const configured=configuredProviders(); const registry=modelRegistry();
  const isModels=slug[0]==="models"; const isHealth=key==="health"; const isSettings=key==="settings";
  return <DashboardShell title={meta.title} eyebrow={meta.eyebrow} action={<Link href="/live" className="button">Run evaluation</Link>}>
    <div className="pageIntro"><div><p className="eyebrow">{meta.eyebrow}</p><h2 className="pageTitle">{meta.title}</h2><p className="pageDesc">{meta.description}</p></div></div>
    {isModels ? <section className="providerGrid">{(Object.keys(registry) as Array<keyof typeof registry>).map(provider=><div className="card" key={provider}><div className="topRow"><div><div className="metricLabel">{provider}</div><h3 className="cardTitle">{registry[provider].length} internal candidates</h3></div><span className={`statusDot ${configured[provider] ? "ok" : "muted"}`}>{configured[provider] ? "Configured" : "Not configured"}</span></div><div className="modelList">{registry[provider].map((model:string,i:number)=><div className="modelRow" key={model}><span>{i+1}</span><span>{model}</span><span className="pill">candidate</span></div>)}</div></div>)}</section> : isHealth ? <section className="grid2">{(Object.keys(configured) as Array<keyof typeof configured>).map(provider=><div className="card" key={provider}><div className="metricLabel">Provider</div><div className="providerName">{provider}</div><div className="healthLine"><span className={`healthBadge ${configured[provider]?"healthy":"offline"}`}>{configured[provider]?"Ready":"Unavailable"}</span><span className="metricDelta">Credentials stay server-side</span></div></div>)}</section> : isSettings ? <section className="grid2"><div className="card"><h3 className="cardTitle">Serving policy</h3><div className="kv"><span>Provider order</span><strong>Gemini → HF → NVIDIA → OpenRouter</strong></div><div className="kv"><span>Fallback</span><strong>Internal cascade</strong></div><div className="kv"><span>User model selection</span><strong>Disabled</strong></div></div><div className="card"><h3 className="cardTitle">Evidence policy</h3><div className="kv"><span>Persisted metrics</span><strong>PostgreSQL / Neon</strong></div><div className="kv"><span>Raw provider errors</span><strong>Server logs only</strong></div><div className="kv"><span>Fabricated metrics</span><strong>Disabled</strong></div></div></section> : <section className="grid2"><div className="card"><div className="metricLabel">Current state</div><div className="empty tall">This surface is wired to the control-plane architecture and will populate from persisted evidence as runs accumulate.</div></div><div className="card"><div className="metricLabel">Evidence-first design</div><ul className="cleanList"><li>Never display invented benchmark numbers.</li><li>Keep provider failures internal and auditable.</li><li>Explain routing decisions with measurable signals.</li></ul></div></section>}
    <div className="pageFooter"><Link href="/" className="textLink">← Back to dashboard</Link><Link href="/live" className="textLink">Open live evaluation →</Link></div>
  </DashboardShell>;
}
