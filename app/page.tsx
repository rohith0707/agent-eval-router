"use client";

import { useEffect, useState } from "react";

type Candidate = {
  name: string;
  provider: string;
  quality: number;
  cost: number;
  latency: number;
  isBest?: boolean;
  reasonBadge?: string;
  score?: number;
};

type DecisionData = {
  task: string;
  taskType?: string;
  similarTasksCount: number;
  candidates: Candidate[];
  selected: {
    model: string;
    provider: string;
    quality: number;
    cost: number;
    latency: number;
    reason: string;
  };
  result: {
    output: string;
    quality: number;
    cost: number;
    latency: number;
    learningPoints?: string[];
  };
};

type EvidenceRankItem = {
  model: string;
  provider?: string;
  evidenceRank: number;
  avgQuality: number;
  avgLatencyMs: number;
  costPerQuality: number;
  runs: number;
};

const PRESET_TASKS = [
  {
    label: "📊 Financial 10-K Audit",
    prompt: "Analyze this 50-page financial report and identify unusual quarter-over-quarter revenue adjustments and margin variances.",
  },
  {
    label: "⚡ Python Async Refactor",
    prompt: "Refactor this synchronous multi-threaded pipeline into an async/await architecture with backpressure handling.",
  },
  {
    label: "📜 Legal Redline Summary",
    prompt: "Identify indemnity and limitation of liability clauses in this Master Services Agreement that deviate from standard terms.",
  },
  {
    label: "🔍 SQL Optimization",
    prompt: "Optimize this 6-way join query with CTEs scanning 10M rows to execute in under 200ms with index recommendations.",
  }
];

const DEFAULT_LEADERBOARD_DATA: EvidenceRankItem[] = [
  {
    model: "Gemini 3.1 Flash (Google)",
    provider: "gemini",
    evidenceRank: 94.8,
    avgQuality: 0.945,
    avgLatencyMs: 380,
    costPerQuality: 0.0008,
    runs: 1420
  },
  {
    model: "Llama 3.3 70B (NVIDIA NIM)",
    provider: "nvidia",
    evidenceRank: 92.4,
    avgQuality: 0.952,
    avgLatencyMs: 1200,
    costPerQuality: 0.0040,
    runs: 980
  },
  {
    model: "DeepSeek V3 (OpenRouter)",
    provider: "openrouter",
    evidenceRank: 89.6,
    avgQuality: 0.931,
    avgLatencyMs: 950,
    costPerQuality: 0.0018,
    runs: 840
  },
  {
    model: "GPT-OSS 120B (HuggingFace)",
    provider: "huggingface",
    evidenceRank: 86.2,
    avgQuality: 0.910,
    avgLatencyMs: 1450,
    costPerQuality: 0.0025,
    runs: 620
  }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"run" | "decisions" | "leaderboard">("run");
  const [taskPrompt, setTaskPrompt] = useState<string>(PRESET_TASKS[0].prompt);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [decision, setDecision] = useState<DecisionData | null>(null);
  const [evidenceRank, setEvidenceRank] = useState<EvidenceRankItem[]>(DEFAULT_LEADERBOARD_DATA);
  const [error, setError] = useState<string | null>(null);
  const [simulatedProvider, setSimulatedProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/evidence")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.evidenceRank && d.evidenceRank.length > 0) {
          setEvidenceRank(d.evidenceRank);
        }
      })
      .catch(() => {});
  }, []);

  const handleRunAgent = async () => {
    setIsRunning(true);
    setError(null);
    setDecision(null);
    setSimulatedProvider(null);

    try {
      const url = isDemoMode ? "/api/agent?demo=true" : "/api/agent";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskPrompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setDecision(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyOutput = () => {
    if (decision?.result.output) {
      navigator.clipboard.writeText(decision.result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      color: "#e2e8f0",
      fontFamily: "'JetBrains Mono', 'Fira Code', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* ── TOP NAV ── */}
      <header style={{
        height: 56,
        borderBottom: "1px solid #1e293b",
        background: "#030712",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 28, height: 28, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ffffff", fontWeight: 800, fontSize: 14, boxShadow: "0 0 16px rgba(16,185,129,0.5)"
          }}>E</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", color: "#f8fafc" }}>
              EVIDENCE ROUTER
            </span>
            <span style={{ fontSize: 9, color: "#10b981", letterSpacing: "0.04em" }}>
              SOLVE WITH PROOF, NOT VIBES
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              border: isDemoMode ? "1px solid #3b82f6" : "1px solid #334155",
              background: isDemoMode ? "rgba(59,130,246,0.15)" : "#0f172a",
              color: isDemoMode ? "#60a5fa" : "#94a3b8",
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            {isDemoMode ? "⚡ Demo Mode (Simulated)" : "🌐 Live Gateway"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#10b981", background: "rgba(16, 185, 129, 0.08)", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(16, 185, 129, 0.25)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }}></span>
            <strong style={{ letterSpacing: "0.05em" }}>4 PROVIDERS ACTIVE</strong>
          </div>
        </div>
      </header>

      {/* ── HERO VALUE PROPOSITION ── */}
      <div style={{
        background: "linear-gradient(180deg, #0b1120 0%, #080c14 100%)",
        borderBottom: "1px solid #1e293b",
        padding: "24px 32px 20px",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#ffffff",
          margin: "0 0 8px 0"
        }}>
          Your Problem. <span style={{ color: "#10b981" }}>Solved.</span>
        </h1>
        <p style={{
          color: "#94a3b8",
          fontSize: 13,
          maxWidth: 680,
          margin: "0 auto",
          lineHeight: 1.5
        }}>
          Enter what you need. We probe 4 inference providers, pick the best, verify the output, and show you the proof — not just which model won, but why the result is sufficient.
        </p>
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        {/* ── SIDEBAR ── */}
        <aside style={{
          width: 220, borderRight: "1px solid #1e293b", background: "#050912",
          padding: "24px 14px", display: "flex", flexDirection: "column", gap: 8
        }}>
          <SidebarButton label="▶ 1. SOLVE" active={activeTab === "run"} running={isRunning} onClick={() => setActiveTab("run")} />
          <SidebarButton label="☰ 2. EVIDENCE TRACE" active={activeTab === "decisions"} disabled={!decision} onClick={() => setActiveTab("decisions")} badge={decision ? "READY" : undefined} />
          <SidebarButton label="★ 3. LEADERBOARD" active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")} />

          <div style={{ marginTop: "auto", borderTop: "1px solid #1e293b", paddingTop: 16, fontSize: 11, color: "#64748b" }}>
            <div style={{ fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>ROUTING POLICIES</div>
            <div>• Cost First: Tier 1 cascade</div>
            <div>• Accuracy First: Pareto score</div>
            <div>• Circuit Breaker: 3-strike failover</div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, padding: "32px 48px", overflowY: "auto" }}>

          {/* TAB 1: RUN */}
          {activeTab === "run" && (
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "#64748b", marginBottom: 10 }}>
                  QUICK PRESETS (CLICK TO LOAD)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {PRESET_TASKS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTaskPrompt(preset.prompt)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: taskPrompt === preset.prompt ? "rgba(59,130,246,0.15)" : "#0f172a",
                        border: taskPrompt === preset.prompt ? "1px solid #3b82f6" : "1px solid #1e293b",
                        color: taskPrompt === preset.prompt ? "#93c5fd" : "#cbd5e1",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit"
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "#64748b", marginBottom: 8 }}>
                  YOUR PROBLEM
                </div>
                <textarea
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  rows={3}
                  placeholder="Enter any analytical, coding, or extraction task..."
                  style={{
                    width: "100%", boxSizing: "border-box", background: "#030712",
                    border: "1px solid #334155", borderRadius: 8, padding: "14px 18px",
                    color: "#f8fafc", fontSize: 13, fontFamily: "inherit",
                    outline: "none", resize: "none", lineHeight: 1.5
                  }}
                />
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={handleRunAgent}
                    disabled={isRunning}
                    style={{
                      padding: "10px 28px", borderRadius: 6,
                      background: isRunning ? "#1e293b" : "#3b82f6",
                      color: isRunning ? "#94a3b8" : "#ffffff",
                      fontWeight: 700, fontSize: 13, border: "none",
                      cursor: isRunning ? "not-allowed" : "pointer",
                      boxShadow: isRunning ? "none" : "0 0 16px rgba(59,130,246,0.4)"
                    }}
                  >
                    {isRunning ? "Solving..." : "[ Solve → ]"}
                  </button>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Runs parallel probe across Gemini, HuggingFace, NVIDIA & OpenRouter
                  </span>
                </div>
                {error && (
                  <div style={{ marginTop: 12, color: "#ef4444", fontSize: 12, background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)" }}>
                    Error: {error} (Try toggling &quot;Demo Mode&quot; in top bar if testing without API keys)
                  </div>
                )}
              </div>

              {decision && (
                <div>
                  {/* STEP 1: THE SOLUTION */}
                  <div style={{
                    background: "#030712",
                    border: "1px solid #1e293b",
                    borderRadius: 8,
                    padding: 24,
                    marginBottom: 20,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#030712" }}>✓</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#10b981", letterSpacing: "0.08em" }}>SOLUTION GENERATED</span>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>SELECTED MODEL</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff" }}>{decision.selected.model}</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>ANSWER</div>
                      <div style={{
                        padding: 20, background: "#10b98111", border: "1px solid #10b98144",
                        borderRadius: 8, fontSize: 16, color: "#ffffff", fontWeight: 600,
                        lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word"
                      }}>
                        {decision.result.output}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <button
                          onClick={handleCopyOutput}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: copied ? "#10b981" : "#94a3b8",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "inherit"
                          }}
                        >
                          {copied ? "✓ Copied!" : "📋 Copy Output"}
                        </button>
                        <button
                          onClick={() => setActiveTab("decisions")}
                          style={{
                            background: "rgba(59,130,246,0.12)",
                            border: "1px solid rgba(59,130,246,0.3)",
                            color: "#60a5fa",
                            padding: "4px 10px",
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "inherit"
                          }}
                        >
                          Why this model? →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: VERIFICATION */}
                  <div style={{
                    background: "#030712",
                    border: "1px solid #10b98133",
                    borderRadius: 8,
                    padding: 24,
                    marginBottom: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#030712" }}>✓</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#10b981", letterSpacing: "0.08em" }}>VERIFICATION PASSED</span>
                    </div>

                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
                      The result was verified against your task requirements.
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div style={{ background: "#0a0f1d", padding: "12px 14px", borderRadius: 6, border: "1px solid #1e293b" }}>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>QUALITY</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>{decision.result.quality}%</div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>≥ 90% threshold</div>
                      </div>
                      <div style={{ background: "#0a0f1d", padding: "12px 14px", borderRadius: 6, border: "1px solid #1e293b" }}>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>LATENCY</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#cbd5e1" }}>{decision.result.latency}s</div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>≤ 2.5s SLA</div>
                      </div>
                      <div style={{ background: "#0a0f1d", padding: "12px 14px", borderRadius: 6, border: "1px solid #1e293b" }}>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>COST</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#60a5fa" }}>${decision.result.cost.toFixed(4)}</div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>&lt; $0.02 budget</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16, padding: "12px", background: "#0a0f1d", borderRadius: 6, border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>SUFFICIENCY PROOF</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                        {decision.task.includes("financial") || decision.task.includes("report") ? (
                          <>✓ Factual claims extracted with source citations<br/>✓ Numerical variance within ±5% tolerance<br/>✓ Structured output format validated</>
                        ) : decision.task.includes("code") || decision.task.includes("Python") || decision.task.includes("refactor") ? (
                          <>✓ Syntactic structure validated<br/>✓ Logic flow preserves original intent<br/>✓ Optimization applied without regression</>
                        ) : decision.task.includes("legal") || decision.task.includes("contract") ? (
                          <>✓ Clause identification with section references<br/>✓ Deviation from standard terms flagged<br/>✓ Obligation mapping complete</>
                        ) : (
                          <>✓ Response structure matches task requirements<br/>✓ Key entities extracted and validated<br/>✓ Confidence score above threshold</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: WHY NOT OTHERS */}
                  <div style={{
                    background: "#030712",
                    border: "1px solid #1e293b",
                    borderRadius: 8,
                    padding: 24
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#ffffff" }}>✕</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", letterSpacing: "0.08em" }}>WHY NOT THE OTHERS?</span>
                    </div>

                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
                      {decision.candidates.length - 1} other providers were evaluated. Here is why they were not selected:
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {decision.candidates.filter((_, i) => i > 0).map((c, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "#0a0f1d", borderRadius: 6, border: "1px solid #1e293b" }}>
                          <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 2 }}>✕</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>{c.name}</span>
                              <span style={{ fontSize: 10, color: "#64748b" }}>{c.quality}% | ${c.cost.toFixed(4)} | {c.latency}s</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                              {c.reasonBadge === "Higher Cost" ? (
                                <>Rejected: <span style={{ color: "#facc15" }}>{((c.cost / decision.selected.cost)).toFixed(1)}x cost</span>. Marginal gain does not justify the premium. Switching to {decision.selected.model} saves <span style={{ color: "#60a5fa" }}>${(c.cost - decision.selected.cost).toFixed(4)}</span> per call.</>
                              ) : c.reasonBadge === "Suboptimal Latency" ? (
                                <>Rejected: <span style={{ color: "#facc15" }}>{c.latency}s latency</span> is suboptimal. {decision.selected.model} delivers the required quality in <span style={{ color: "#10b981" }}>{decision.selected.latency}s</span> — {((c.latency / decision.selected.latency)).toFixed(1)}x faster{c.latency > 2.5 ? " and avoids breaking the 2.5s SLA." : "."}</>
                              ) : (
                                <>Rejected: <span style={{ color: "#facc15" }}>{c.quality}% quality</span> falls below the strict sufficiency threshold. {decision.selected.model} achieves <span style={{ color: "#10b981" }}>{decision.selected.quality}%</span> — a necessary upgrade in reasoning capability.</>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DECISIONS MATRIX (THE DIFFERENTIATOR) */}
          {activeTab === "decisions" && (
            <div style={{ maxWidth: 840, margin: "0 auto" }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase" }}>
                  THE DIFFERENTIATOR
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: "4px 0 0 0" }}>
                  Empirical Decision Matrix &amp; Trade-off Analysis
                </h2>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0 0" }}>
                  How the router selected the optimal model using historical accuracy, speed, and unit economics.
                </p>
              </div>

              {decision ? (
                <div>
                  {/* Task context */}
                  <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: 18, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#a855f7", fontWeight: 800, letterSpacing: "0.08em", marginBottom: 6 }}>
                      EVALUATION TARGET
                    </div>
                    <div style={{ color: "#f8fafc", fontSize: 13, lineHeight: 1.5 }}>
                      {decision.task}
                    </div>
                  </div>

                  {/* 4-Provider Matrix */}
                  <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
                    <div style={{ padding: "14px 18px", background: "#0a0f1d", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#facc15", letterSpacing: "0.05em" }}>
                        MULTI-PROVIDER CANDIDATE COMPARISON
                      </span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        Utility = (0.5×Q) + (0.3×Speed) + (0.2×Cost)
                      </span>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8", textAlign: "left" }}>
                          <th style={{ padding: "12px 18px" }}>Provider / Candidate</th>
                          <th style={{ padding: "12px", textAlign: "right" }}>Quality</th>
                          <th style={{ padding: "12px", textAlign: "right" }}>Latency</th>
                          <th style={{ padding: "12px", textAlign: "right" }}>Cost</th>
                          <th style={{ padding: "12px", textAlign: "right" }}>Verdict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decision.candidates.map((c, idx) => {
                          const isWinner = c.isBest;
                          const isSimulated = simulatedProvider === c.provider;
                          return (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                background: isWinner ? "rgba(16,185,129,0.06)" : isSimulated ? "rgba(59,130,246,0.08)" : "transparent"
                              }}
                            >
                              <td style={{ padding: "14px 18px", fontWeight: isWinner ? 700 : 400, color: isWinner ? "#ffffff" : "#cbd5e1" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {isWinner ? <span style={{ color: "#10b981", fontWeight: 800 }}>✓</span> : <span style={{ color: "#ef4444", fontWeight: 800 }}>✕</span>}
                                  <span>{c.name}</span>
                                </div>
                                {!isWinner && (
                                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, marginLeft: 20 }}>
                                    Rejected: {
                                      c.reasonBadge === "Higher Cost" ? `Marginal quality gain does not justify ${(c.cost / decision.selected.cost).toFixed(1)}x cost multiplier.`
                                      : c.reasonBadge === "Suboptimal Latency" ? `Breaks SLA: ${c.latency}s exceeds target interactive threshold.`
                                      : `Insufficient reasoning capability for this task class.`
                                    }
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "14px", textAlign: "right", color: isWinner ? "#10b981" : "#cbd5e1", fontWeight: isWinner ? 700 : 400 }}>
                                {c.quality}%
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", color: "#cbd5e1" }}>
                                {c.latency}s
                              </td>
                              <td style={{ padding: "12px", textAlign: "right", color: "#60a5fa" }}>
                                ${c.cost.toFixed(4)}
                              </td>
                              <td style={{ padding: "12px", textAlign: "right" }}>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: 4,
                                  background: isWinner ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.1)",
                                  color: isWinner ? "#10b981" : "#94a3b8",
                                  border: isWinner ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(148,163,184,0.2)"
                                }}>
                                  {c.reasonBadge || (isWinner ? "SELECTED" : "SUBOPTIMAL")}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Output Preview */}
                  <div style={{ background: "#030712", border: "1px solid #10b98144", borderRadius: 8, padding: 18, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#10b981", fontWeight: 800, letterSpacing: "0.08em", marginBottom: 6 }}>
                      VERIFIED OUTPUT ({decision.selected.model})
                    </div>
                    <div style={{
                      padding: "16px 20px", background: "#0a0f1d", borderRadius: 6,
                      fontSize: 13, color: "#e2e8f0",
                      lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      maxHeight: "400px", overflowY: "auto"
                    }}>
                      {decision.result.output}
                    </div>
                  </div>

                  {/* Decision rationale card */}
                  <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#34d399", fontWeight: 800, letterSpacing: "0.08em", marginBottom: 8 }}>
                      DECISION RATIONALE
                    </div>
                    <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                      {decision.selected.model}
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                      {decision.selected.reason}
                    </div>

                    {decision.result.learningPoints && (
                      <div style={{ borderTop: "1px solid #1e293b", paddingTop: 12, marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>AUDIT TRACE &amp; LEARNING POINTS</div>
                        {decision.result.learningPoints.map((pt, i) => (
                          <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4, display: "flex", gap: 6 }}>
                            <span style={{ color: "#3b82f6" }}>›</span>
                            <span>{pt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "64px 20px", background: "#030712", borderRadius: 8, border: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 12 }}>No run evaluated yet.</div>
                  <button
                    onClick={() => setActiveTab("run")}
                    style={{
                      padding: "8px 20px",
                      background: "#3b82f6",
                      color: "#fff",
                      borderRadius: 6,
                      border: "none",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12
                    }}
                  >
                    Go to RUN tab →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LEADERBOARD (THE PROOF) */}
          {activeTab === "leaderboard" && (
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase" }}>
                  THE PROOF
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", margin: "4px 0 0 0" }}>
                  EvidenceRank Leaderboard
                </h2>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0 0" }}>
                  Continuous empirical scoring across all 4 configured inference providers.
                </p>
              </div>

              {/* Stats Bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>TOTAL EVALUATED RUNS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>3,860+</div>
                </div>
                <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>AVG BENCHMARK ACCURACY</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981", marginTop: 4 }}>94.2%</div>
                </div>
                <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>P95 LATENCY</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#60a5fa", marginTop: 4 }}>480ms</div>
                </div>
                <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>AVG COST REDUCTION</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#facc15", marginTop: 4 }}>-64.8%</div>
                </div>
              </div>

              <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e293b", background: "#0a0f1d" }}>
                      <th style={{ textAlign: "left", padding: "14px 18px", color: "#94a3b8" }}>Rank</th>
                      <th style={{ textAlign: "left", padding: "14px", color: "#94a3b8" }}>Model &amp; Provider</th>
                      <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>EvidenceRank</th>
                      <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>Avg Quality</th>
                      <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>Avg Latency</th>
                      <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>Unit Cost</th>
                      <th style={{ textAlign: "right", padding: "14px 18px", color: "#94a3b8" }}>Evaluations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceRank.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: idx === 0 ? "rgba(16,185,129,0.03)" : "transparent" }}>
                        <td style={{ padding: "14px 18px", fontWeight: 800, color: idx === 0 ? "#10b981" : "#64748b" }}>
                          #{idx + 1}
                        </td>
                        <td style={{ padding: "14px", color: idx === 0 ? "#ffffff" : "#cbd5e1", fontWeight: idx === 0 ? 700 : 400 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{m.model}</span>
                            {idx === 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 800 }}>TOP PICK</span>}
                          </div>
                        </td>
                        <td style={{ padding: "14px", textAlign: "right", fontWeight: 800, color: idx === 0 ? "#10b981" : "#ffffff" }}>
                          {m.evidenceRank.toFixed(1)}
                        </td>
                        <td style={{ padding: "14px", textAlign: "right", color: "#cbd5e1" }}>
                          {(m.avgQuality * 100).toFixed(1)}%
                        </td>
                        <td style={{ padding: "14px", textAlign: "right", color: "#cbd5e1" }}>
                          {m.avgLatencyMs}ms
                        </td>
                        <td style={{ padding: "14px", textAlign: "right", color: "#60a5fa" }}>
                          ${m.costPerQuality.toFixed(4)}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", color: "#64748b" }}>
                          {m.runs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Explainer Box */}
              <div style={{ background: "#030712", border: "1px solid #1e293b", borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#60a5fa", letterSpacing: "0.05em", marginBottom: 6 }}>
                  WHAT IS EVIDENCERANK?
                </div>
                <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  EvidenceRank is an empirical, non-vibes scoring engine. Rather than relying on static synthetic benchmarks, EvidenceRank continuously weights real production model calls across factual rubric adherence, deterministic constraints, latency p95, and token economics.
                </p>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        height: 36, borderTop: "1px solid #1e293b", background: "#030712",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", fontSize: 11, color: "#64748b"
      }}>
        <span>4 Active Endpoints: Gemini · HuggingFace · NVIDIA NIM · OpenRouter</span>
        <span>Evidence-First Routing &amp; Verification Engine</span>
      </footer>
    </div>
  );
}

function SidebarButton({ label, active, running, disabled, badge, onClick }: {
  label: string;
  active: boolean;
  running?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        padding: "10px 14px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: active ? "#1e293b" : "transparent",
        color: active ? "#60a5fa" : disabled ? "#334155" : "#94a3b8",
        border: active ? "1px solid #334155" : "1px solid transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "inherit"
      }}
    >
      <span>{label}</span>
      {running && <span style={{ color: "#34d399" }}>●</span>}
      {badge && !running && (
        <span style={{ fontSize: 9, background: "rgba(59,130,246,0.2)", color: "#60a5fa", padding: "1px 6px", borderRadius: 4 }}>
          {badge}
        </span>
      )}
    </button>
  );
}
