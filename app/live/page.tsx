"use client";

import { useState } from "react";

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
      try { data = JSON.parse(text); } catch { throw new Error(`API returned non-JSON (${response.status}). ${text.slice(0, 160)}`); }
      if (!response.ok) throw new Error(data.error || "Evaluation failed");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Evaluation failed"); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-5 py-10 text-zinc-100 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Live Evidence Mode</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-4xl font-semibold tracking-tight">Agent Evaluation & Routing</h1><p className="mt-2 text-zinc-400">Real NVIDIA NIM inference → evaluation → routing → persisted evidence.</p></div>
          <a href="/" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">← Dashboard</a>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.025] p-6">
          <label className="text-xs font-medium tracking-widest text-zinc-500">TASK</label>
          <textarea value={task} onChange={e => setTask(e.target.value)} rows={5} className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-4 text-sm outline-none focus:border-white/30" />
          <button onClick={run} disabled={loading || !task.trim()} className="mt-4 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50">{loading ? "Running real evaluation…" : "Run real evaluation"}</button>
          {error && <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}
        </section>

        {result && <div className="mt-6 space-y-5">
          {result.source !== "nvidia_nim" && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">Fallback evidence: NVIDIA was unavailable. This result is not presented as a real NVIDIA run.</div>}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["Selected model", result.decision.selectedModel], ["Quality", `${(result.metrics.quality * 100).toFixed(1)}%`], ["Latency", result.metrics.latencyMs ? `${result.metrics.latencyMs} ms` : "N/A"], ["Run ID", result.runId]].map(([k,v]) => <div key={k} className="rounded-xl border border-white/10 bg-white/[.025] p-5"><div className="text-xs text-zinc-500">{k}</div><div className="mt-2 break-all font-semibold">{v}</div></div>)}
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-semibold">Routing decision</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{result.decision.reason}</p></section>
          <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-semibold">Model output</h2><pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{result.candidates?.[0]?.output || "No output"}</pre></section>
          <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-semibold">Execution trace</h2><div className="mt-4 space-y-3">{result.trace?.map((t:any) => <div key={t.step} className="border-t border-white/5 pt-3"><div className="text-sm font-medium">{t.status === "complete" ? "✓" : "•"} {t.step}</div><div className="mt-1 text-xs text-zinc-500">{t.detail}</div></div>)}</div></section>
        </div>}
      </div>
    </main>
  );
}
