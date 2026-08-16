import DashboardShell from "@/app/components/DashboardShell";

const categories = [
  ["Reasoning",5], ["Structured output",5], ["Tool calling",5],
  ["RAG",5], ["Agent planning",5], ["Reliability",5],
  ["Text-to-SQL",5], ["Safety / injection",5], ["Code generation",5], ["Regression",5]
] as const;

export default function Benchmarks(){
 return <DashboardShell title="50-Case Benchmark" eyebrow="Evaluation"><div className="topRow"><div><div className="sectionSub">A fixed, project-owned suite for routing, reliability, safety and task quality.</div></div><button className="button">Run 50 cases</button></div>
  <section className="grid4" style={{marginTop:18}}>
   <Metric label="Cases" value="50" sub="Project-owned test cases"/><Metric label="Categories" value="10" sub="Production-style workloads"/><Metric label="Models" value="Internal registry" sub="Provider-managed candidates"/><Metric label="Status" value="Not run" sub="No benchmark results fabricated"/>
  </section>
  <section className="grid2" style={{marginTop:18}}>
   <div className="card"><h2 className="sectionTitle">What this benchmark answers</h2><div className="listBlock"><Row title="Quality" text="Does the selected model solve the task correctly?"/><Row title="Reliability" text="What happens when a provider/model fails?"/><Row title="Latency" text="Can the system meet the configured response budget?"/><Row title="Routing" text="Does the router choose a better candidate than a fixed-model baseline?"/></div></div>
   <div className="card"><h2 className="sectionTitle">Coverage</h2><div className="coverage">{categories.map(([name,count])=><div className="coverageRow" key={name}><span>{name}</span><span className="pill">{count} cases</span></div>)}</div></div>
  </section>
  <section className="card" style={{marginTop:18}}><h2 className="sectionTitle">Benchmark policy</h2><p className="sectionSub">The suite is fixed so model/routing changes can be compared against the same 50 cases. Production traffic and external gated benchmarks stay separate.</p><div className="policyGrid"><div><b>Baseline</b><span>Single-model routing</span></div><div><b>Baseline</b><span>Cheapest model</span></div><div><b>Baseline</b><span>Fastest model</span></div><div><b>Primary objective</b><span>Quality subject to latency, cost and reliability</span></div></div></section>
 </DashboardShell>
}
function Metric({label,value,sub}:{label:string,value:string,sub:string}){return <div className="card"><div className="metricLabel">{label}</div><div className="metricValue">{value}</div><div className="metricDelta">{sub}</div></div>}
function Row({title,text}:{title:string,text:string}){return <div className="listRow"><div className="listTitle">{title}</div><div className="sectionSub">{text}</div></div>}
