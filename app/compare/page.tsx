"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ComparePayload = {
  verdict: "SHIP" | "REVIEW" | "BLOCK";
  reasons: string[];
  baseline: {
    sha: string;
    count: number;
    averageQuality: number;
    averageLatencyMs: number;
    totalCostUsd: number;
    passedCount: number;
    passRate: number;
    modelMix: Record<string, number>;
  };
  head: {
    sha: string;
    count: number;
    averageQuality: number;
    averageLatencyMs: number;
    totalCostUsd: number;
    passedCount: number;
    passRate: number;
    modelMix: Record<string, number>;
  };
  delta: {
    quality: number;
    qualityPct: number;
    latencyMs: number;
    latencyPct: number;
    costUsd: number;
    costPct: number;
    passRate: number;
  };
  timestamp: string;
};

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ComparePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseline = searchParams?.get("baseline") ?? "previous";
  const head = searchParams?.get("head") ?? "current";

  useEffect(() => {
    fetch(`/api/compare?baseline=${encodeURIComponent(baseline)}&head=${encodeURIComponent(head)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Compare failed with status ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [baseline, head]);

  if (loading) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px", color: "#f3f4f6", fontFamily: "var(--font-geist-sans)" }}>
        <p style={{ color: "#9ca3af" }}>Evaluating before/after evidence runs…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px", color: "#f3f4f6", fontFamily: "var(--font-geist-sans)" }}>
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 10, padding: 20 }}>
          <h2 style={{ color: "#ef4444", margin: "0 0 8px 0", fontSize: 18 }}>Compare Failed</h2>
          <p style={{ color: "#fca5a5", margin: 0, fontSize: 14 }}>{error ?? "Unknown error"}</p>
          <div style={{ marginTop: 16 }}>
            <Link href="/" style={{ color: "#60a5fa", fontSize: 13 }}>← Back to Dashboard</Link>
          </div>
        </div>
      </main>
    );
  }

  const verdictColors = {
    SHIP: { bg: "rgba(16, 185, 129, 0.1)", border: "#10b981", text: "#10b981", label: "✓ SHIP IT — No Regressions Detected" },
    REVIEW: { bg: "rgba(234, 179, 8, 0.1)", border: "#eab308", text: "#eab308", label: "⚠ REVIEW — Minor Tradeoffs Found" },
    BLOCK: { bg: "rgba(239, 68, 68, 0.1)", border: "#ef4444", text: "#ef4444", label: "✕ BLOCK — Quality or Cost Regression" },
  }[data.verdict];

  const fmtPct = (n: number, invert = false) => {
    const sign = n > 0 ? "+" : "";
    const color = (n > 0 ? !invert : invert) ? "#10b981" : n === 0 ? "#9ca3af" : "#ef4444";
    return <span style={{ color }}>{sign}{n}%</span>;
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px", color: "#f3f4f6", fontFamily: "var(--font-geist-sans)" }}>
      {/* 1. HEADER */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#60a5fa", textTransform: "uppercase" }}>
          AGENT EVAL ROUTER / REGRESSION GATE
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "6px 0 4px 0", color: "#ffffff", letterSpacing: "-0.03em" }}>
          Behavior Diff: {head.slice(0, 7)} vs {baseline.slice(0, 7)}
        </h1>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: 0 }}>
          Empirical comparison across {data.head.count + data.baseline.count} evaluation runs.
        </p>
      </div>

      {/* 2. VERDICT BANNER */}
      <section style={{
        background: verdictColors.bg,
        border: `2px solid ${verdictColors.border}`,
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 32
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: verdictColors.text }}>
          {verdictColors.label}
        </div>
        <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, color: "#d1d5db", fontSize: 13, lineHeight: 1.6 }}>
          {data.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      {/* 3. FOUR KPI DELTA CARDS */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>Quality Score</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", margin: "6px 0" }}>
            {(data.head.averageQuality * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            was {(data.baseline.averageQuality * 100).toFixed(1)}% ({fmtPct(data.delta.qualityPct)})
          </div>
        </div>

        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>Avg Latency</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", margin: "6px 0" }}>
            {data.head.averageLatencyMs}ms
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            was {data.baseline.averageLatencyMs}ms ({fmtPct(data.delta.latencyPct, true)})
          </div>
        </div>

        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>Batch Cost</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", margin: "6px 0" }}>
            ${data.head.totalCostUsd.toFixed(4)}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            was ${data.baseline.totalCostUsd.toFixed(4)} ({fmtPct(data.delta.costPct, true)})
          </div>
        </div>

        <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>Pass Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", margin: "6px 0" }}>
            {(data.head.passRate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            was {(data.baseline.passRate * 100).toFixed(1)}%
          </div>
        </div>
      </section>

      {/* 4. MODEL SELECTION MIX DIFF */}
      <section style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "#ffffff" }}>
          Model Selection Shift
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
              Baseline ({baseline.slice(0, 7)})
            </div>
            {Object.entries(data.baseline.modelMix).length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>No runs recorded for baseline</p>
            ) : (
              Object.entries(data.baseline.modelMix).map(([m, c]) => (
                <div key={m} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                  <span>{m}</span>
                  <strong style={{ color: "#ffffff" }}>{c} ({((c / data.baseline.count) * 100).toFixed(0)}%)</strong>
                </div>
              ))
            )}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
              Head ({head.slice(0, 7)})
            </div>
            {Object.entries(data.head.modelMix).length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>No runs recorded for head</p>
            ) : (
              Object.entries(data.head.modelMix).map(([m, c]) => (
                <div key={m} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                  <span>{m}</span>
                  <strong style={{ color: "#10b981" }}>{c} ({((c / data.head.count) * 100).toFixed(0)}%)</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#6b7280" }}>
        <Link href="/" style={{ color: "#60a5fa" }}>← Back to Live Dashboard</Link>
        <span>Evaluated at {new Date(data.timestamp).toLocaleTimeString()}</span>
      </footer>
    </main>
  );
}
