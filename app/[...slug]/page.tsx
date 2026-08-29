import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { configuredProviders, modelRegistry } from "@/lib/providers";
import { db, databaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

const copy: Record<string, { title: string; eyebrow: string; description: string }> = {
  runs: { title: "Evaluation Runs", eyebrow: "Evidence", description: "Reproducible AI runs with outcomes, decisions, and traces." },
  benchmarks: { title: "Benchmark", eyebrow: "Evaluate", description: "Compare AI strategies on fixed, product-style tasks and regression cases." },
  datasets: { title: "Evaluation Cases", eyebrow: "Evaluate", description: "Versioned tasks, expected behavior, and task-specific success criteria." },
  models: { title: "Model Strategies", eyebrow: "Models", description: "Internal candidates grouped by capability, cost tier, and task fit." },
  performance: { title: "Model Performance", eyebrow: "Models", description: "Compare quality, latency, reliability, token usage, and cost by model." },
  routing: { title: "Strategy Decisions", eyebrow: "Evidence", description: "See why a model strategy was selected, rejected, or replaced." },
  policies: { title: "AI Policies", eyebrow: "Evaluate", description: "Quality, latency, cost, and reliability constraints used by the AI system." },
  health: { title: "AI Reliability", eyebrow: "Reliability", description: "Provider health, failure patterns, fallback behavior, and recovery signals." },
  failures: { title: "Failure Analysis", eyebrow: "Reliability", description: "Turn model and workflow failures into actionable evaluation evidence." },
  traces: { title: "Execution Evidence", eyebrow: "Evidence", description: "Step-by-step traces from task intake through model execution and grading." },
  latency: { title: "Latency", eyebrow: "Evidence", description: "Response-time signals by task, strategy, and provider." },
  cost: { title: "Cost & Tokens", eyebrow: "Evidence", description: "Token usage and estimated economics for every evaluated workflow." },
  reports: { title: "Case Study", eyebrow: "Evidence", description: "A shareable summary of what improved, what failed, and why." },
  settings: { title: "Configuration", eyebrow: "System", description: "Server-side configuration. Provider credentials and model IDs stay out of the user workflow." },
};

type RunEvidence = { externalId: string; task: string; status: string; selectedModel: string; quality: number; latencyMs: number; createdAt: Date; traceJson: unknown };
function evidenceObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function display(value: unknown, fallback = "—") { if (value === null || value === undefined || value === "") return fallback; if (["string", "number", "boolean"].includes(typeof value)) return String(value); return JSON.stringify(value); }
async function recentRuns(): Promise<RunEvidence[]> {
  if (!databaseConfigured()) return [];
  try { return await db.evaluationRun.findMany({ select: { externalId: true, task: true, status: true, selectedModel: true, quality: true, latencyMs: true, createdAt: true, traceJson: true }, orderBy: { createdAt: "desc" }, take: 50 }) as RunEvidence[]; }
  catch { return []; }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const key = slug.at(-1) ?? slug[0] ?? "";
  const meta = copy[key] ?? { title: "AI Workspace", eyebrow: "AI Engineer", description: "Build, evaluate, and improve an AI workflow with measurable evidence." };
  const configured = configuredProviders();
  const registry = modelRegistry();
  const runs = await recentRuns();
  const isModels = slug[0] === "models";
  const isHealth = key === "health";
  const isSettings = key === "settings";
  const isRouting = key === "routing";
  const isTraces = key === "traces" || key === "runs";

  return <DashboardShell title={meta.title} eyebrow={meta.eyebrow} action={<Link href="/live" className="button">Open Product AI Lab</Link>}>
    <div className="pageIntro"><div><p className="eyebrow">{meta.eyebrow}</p><h2 className="pageTitle">{meta.title}</h2><p className="pageDesc">{meta.description}</p></div></div>
    {isModels ? <section className="providerGrid">{(Object.keys(registry) as Array<keyof typeof registry>).map((provider) => <div className="card" key={provider}><div className="topRow"><div><div className="metricLabel">{provider}</div><h3 className="cardTitle">{registry[provider].length} candidate models</h3></div><span className={`statusDot ${configured[provider] ? "ok" : "muted"}`}>{configured[provider] ? "Ready" : "Needs setup"}</span></div><div className="modelList">{registry[provider].map((model: string, index: number) => <div className="modelRow" key={model}><span>{index + 1}</span><span>{model}</span><span className="pill">candidate</span></div>)}</div></div>)}</section>
    : isHealth ? <section className="grid2">{(Object.keys(configured) as Array<keyof typeof configured>).map((provider) => <div className="card" key={provider}><div className="metricLabel">Provider</div><div className="providerName">{provider}</div><div className="healthLine"><span className={`healthBadge ${configured[provider] ? "healthy" : "offline"}`}>{configured[provider] ? "Configured" : "Unavailable"}</span><span className="metricDelta">Credentials stay server-side</span></div></div>)}</section>
    : isSettings ? <section className="grid2"><div className="card"><h3 className="cardTitle">AI decision policy</h3><div className="kv"><span>Task selection</span><strong>Capability + cost + reliability</strong></div><div className="kv"><span>Long-horizon path</span><strong>Reasoning / Ox Alpha escalation</strong></div><div className="kv"><span>User model selection</span><strong>Disabled by default</strong></div></div><div className="card"><h3 className="cardTitle">Evidence policy</h3><div className="kv"><span>Persisted metrics</span><strong>PostgreSQL / Neon</strong></div><div className="kv"><span>Provider secrets</span><strong>Server-side only</strong></div><div className="kv"><span>Fabricated metrics</span><strong>Disabled</strong></div></div></section>
    : (isRouting || isTraces) ? <section className="grid2"><div className="card"><div className="topRow"><div><div className="metricLabel">Persisted evidence</div><h3 className="cardTitle">{runs.length} recent runs</h3></div><span className="pill">real data</span></div>{runs.length === 0 ? <div className="empty tall">No persisted evaluation runs are available yet. Run the Product AI Lab first.</div> : <div className="modelList">{runs.map((run) => <div className="modelRow" key={run.externalId}><span className={run.status === "passed" ? "statusDot ok" : "statusDot muted"} /><Link className="textLink" href={`/runs?run=${encodeURIComponent(run.externalId)}`}>{run.externalId}</Link><span>{run.selectedModel}</span><span>{(run.quality * 100).toFixed(1)}%</span></div>)}</div>}</div><div className="card"><div className="metricLabel">Decision and trace evidence</div>{runs.length === 0 ? <div className="empty tall">Routing rationale, candidates, evaluator output, latency and fallback evidence appear here after a real run.</div> : (() => { const run = runs[0]; const trace = evidenceObject(run.traceJson); return <><h3 className="cardTitle">Latest: {run.selectedModel}</h3><div className="kv"><span>Task</span><strong>{run.task}</strong></div><div className="kv"><span>Status</span><strong>{run.status}</strong></div><div className="kv"><span>Quality</span><strong>{(run.quality * 100).toFixed(1)}%</strong></div><div className="kv"><span>Latency</span><strong>{run.latencyMs} ms</strong></div><div className="kv"><span>Routing rationale</span><strong>{display(trace.routingReason ?? trace.reason ?? trace.rationale, "Not recorded")}</strong></div><div className="kv"><span>Fallback</span><strong>{display(trace.fallback ?? trace.fallbackCount, "0")}</strong></div><div className="kv"><span>Trace</span><strong>{display(trace.traceId ?? run.externalId)}</strong></div></>; })()}</div></section>
    : <section className="grid2"><div className="card"><div className="metricLabel">Product question</div><div className="empty tall">Use this surface to answer one AI-product question with real evidence from evaluated runs.</div></div><div className="card"><div className="metricLabel">Evidence-first design</div><ul className="cleanList"><li>Measure task success before optimizing the model.</li><li>Separate model failures from infrastructure failures.</li><li>Turn repeat failures into regression cases.</li></ul></div></section>}
    <div className="pageFooter"><Link href="/" className="textLink">← Back to overview</Link><Link href="/live" className="textLink">Open Product AI Lab →</Link></div>
  </DashboardShell>;
}
