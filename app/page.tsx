"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const r = await fetch("/api/runs", { cache: "no-store" });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || "Could not load runs");
    setData(json);
  }
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);

  async function runEvaluation() {
    setRunning(true); setError("");
    try {
      const r = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Evaluation failed");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Evaluation failed"); }
    finally { setRunning(false); }
  }

  const summary = data?.summary;
  const runs = data?.runs || [];
  return <div className="min-h-screen bg-[#09090b] text-zinc-100">
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-white/10 bg-[#0c0c0f] p-5 md:block">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-white font-bold text-black">A</div><div><div className="font-semibold">Agent Eval</div><div className="text-xs text-zinc-500">Router</div></div></div>
      <nav className="space-y-1 text-sm"><div className="rounded-lg bg-white/10 px-3 py-2">Overview</div><a href="/live" className="block rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/5">Live Evaluation</a><div className="px-3 py-2 text-zinc-600">Models</div><div className="px-3 py-2 text-zinc-600">Routing</div><div className="px-3 py-2 text-zinc-600">Failures</div><div className="px-3 py-2 text-zinc-600">Traces</div><div className="px-3 py-2 text-zinc-600">Datasets</div><div className="px-3 py-2 text-zinc-600">Reports</div></nav>
    </aside>
    <main className="md:ml-60"><header className="flex h-16 items-center justify-between border-b border-white/10 px-6"><div><div className="text-xs text-zinc-500">Workspace / Agent Eval Router</div><h1 className="font-semibold">Evaluation Overview</h1></div><a href="/live" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Live evaluation</a></header>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">Metrics below are derived from persisted evaluation runs. No benchmark numbers are fabricated.</div>
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[["Evaluations", summary?.count ?? "—", "persisted runs"],["Average quality", summary?.avgQuality == null ? "—" : `${(summary.avgQuality*100).toFixed(1)}%`, "observed"],["p95 latency", summary?.p95LatencyMs == null ? "—" : `${summary.p95LatencyMs}ms`, "observed"],["Pass rate", summary?.passRate == null ? "—" : `${(summary.passRate*100).toFixed(1)}%`, "observed"]].map(([a,b,c])=><div key={a} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="text-sm text-zinc-500">{a}</div><div className="mt-2 text-2xl font-semibold">{b}</div><div className="mt-2 text-xs text-zinc-600">{c}</div></div>)}
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-semibold">Evaluation playground</h2><p className="mt-1 text-sm text-zinc-500">Use the real NVIDIA path for evidence. This deterministic route remains useful for local routing tests.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input value={task} onChange={e=>setTask(e.target.value)} placeholder="Enter a routing/evaluation task" className="flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"/><button disabled={running} onClick={runEvaluation} className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50">{running?"Running…":"Run evaluation"}</button></div></section>
        <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Recent runs</h2><p className="text-sm text-zinc-500">Latest persisted evaluation evidence</p></div><a href="/live" className="text-sm text-zinc-300 hover:text-white">Open live mode →</a></div>{runs.length === 0 ? <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-zinc-600">No evaluations yet. Run the first real evaluation from Live Evaluation.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-zinc-500"><tr><th className="py-3">Run</th><th>Model</th><th>Quality</th><th>Latency</th><th>Status</th></tr></thead><tbody>{runs.map((r:any)=><tr key={r.externalId} className="border-b border-white/5"><td className="py-4 font-mono text-xs">{r.externalId}</td><td>{r.selectedModel}</td><td>{(r.quality*100).toFixed(1)}%</td><td>{r.latencyMs ? `${r.latencyMs}ms` : "N/A"}</td><td>{r.status}</td></tr>)}</tbody></table></div>}</section>
      </div>
    </main>
  </div>;
}
