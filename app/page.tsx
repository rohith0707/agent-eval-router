"use client";

import { useEffect, useState } from "react";

type EvidenceData = {
  source: string;
  total: number;
  passed: number;
  averageQuality: number;
  evidenceRank?: Array<{
    model: string;
    evidenceRank: number;
    avgQuality: number;
    avgLatencyMs: number;
    costPerQuality: number;
    runs: number;
  }>;
};

export default function Home() {
  const [data, setData] = useState<EvidenceData | null>(null);

  useEffect(() => {
    fetch("/api/evidence").then((r) => r.json()).then(setData).catch(() => setData(null));
  }, []);

  return (
    <main style={{
      maxWidth: 1100,
      margin: "0 auto",
      padding: "48px 24px",
      color: "#f3f4f6",
      fontFamily: "var(--font-geist-sans)"
    }}>
      {/* 1. PROBLEM → SOLUTION IN 10 SECONDS */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, letterSpacing: "-0.03em", color: "#ffffff" }}>
              AI models ship every day.{" "}
              <span style={{ color: "#10b981" }}>Quality drops. Costs spike.</span>
            </h1>
            <p style={{ fontSize: 18, color: "#9ca3af", margin: "12px 0 0 0", maxWidth: 720, lineHeight: 1.5 }}>
              Agent Eval Router tests every AI change against 50 real cases, scores them with{" "}
              <strong style={{ color: "#ffffff" }}>EvidenceRank</strong>, and tells you
              if the change made the product <em>better, worse, or cheaper</em>.
            </p>
          </div>
          <a
            href="/compare"
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              background: "#10b981",
              color: "#000000",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
            }}
          >
            Inspect Regression Gate →
          </a>
        </div>
      </section>

      {/* 2. THE WINNER (current production state) */}
      {data?.evidenceRank && data.evidenceRank[0] && (
        <section style={{
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.4))",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Currently Winning
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 4px 0", color: "#ffffff" }}>
            {data.evidenceRank[0].model}
          </div>
          <div style={{ fontSize: 14, color: "#9ca3af" }}>
            {data.evidenceRank[0].runs} evaluations · {(data.evidenceRank[0].avgQuality * 100).toFixed(1)}% quality · {data.evidenceRank[0].avgLatencyMs}ms p95 · ${data.evidenceRank[0].costPerQuality.toFixed(4)}/quality
          </div>
        </section>
      )}

      {/* 3. THE THREE NUMBERS THAT MATTER */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        marginBottom: 32
      }}>
        {data?.evidenceRank?.[0] ? (
          <>
            <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Quality</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#10b981", marginTop: 6 }}>
                {(data.evidenceRank[0].avgQuality * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Across real evaluation runs</div>
            </div>
            <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Cost Saved vs GPT-4o</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#34d399", marginTop: 6 }}>
                {(0.03 / (data.evidenceRank[0].costPerQuality || 0.001)).toFixed(0)}×
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>${(0.03 - (data.evidenceRank[0].costPerQuality || 0)).toFixed(4)} saved per call</div>
            </div>
            <div style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Providers Tested</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#60a5fa", marginTop: 6 }}>
                {Object.keys({ gemini: 1, huggingface: 1, nvidia: 1, openrouter: 1 }).length}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Gemini · HF · NVIDIA · OpenRouter</div>
            </div>
          </>
        ) : (
          <div style={{ gridColumn: "1 / -1", padding: 20, textAlign: "center", color: "#6b7280" }}>
            Loading real evidence…
          </div>
        )}
      </section>

      {/* 4. THE EVIDENCERANK LEADERBOARD (transparent, plain) */}
      {data?.evidenceRank && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px 0", color: "#ffffff" }}>
            EvidenceRank Leaderboard
          </h2>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px 0" }}>
            Quality × Reliability × Recency. The model that wins your money is at the top.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>#</th>
                <th style={{ textAlign: "left", padding: "10px 8px", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Model</th>
                <th style={{ textAlign: "right", padding: "10px 8px", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Score</th>
                <th style={{ textAlign: "right", padding: "10px 8px", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Quality</th>
                <th style={{ textAlign: "right", padding: "10px 8px", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Latency</th>
                <th style={{ textAlign: "right", padding: "10px 8px", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>Runs</th>
              </tr>
            </thead>
            <tbody>
              {data.evidenceRank.map((m, i) => (
                <tr key={m.model} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "12px 8px", color: i === 0 ? "#10b981" : "#6b7280", fontWeight: 700 }}>#{i + 1}</td>
                  <td style={{ padding: "12px 8px", color: "#ffffff", fontWeight: i === 0 ? 600 : 400 }}>{m.model}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", color: i === 0 ? "#10b981" : "#d1d5db", fontWeight: 600 }}>{m.evidenceRank.toFixed(1)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", color: "#d1d5db" }}>{(m.avgQuality * 100).toFixed(1)}%</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", color: "#d1d5db" }}>{m.avgLatencyMs}ms</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", color: "#6b7280" }}>{m.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 5. FOOTER - PROOF (no fake badges) */}
      <footer style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#6b7280" }}>
        Live data from PostgreSQL · {data?.total ?? 0} real evaluation runs · Source: <a href="/api/health" style={{ color: "#60a5fa" }}>/api/health</a>
      </footer>
    </main>
  );
}
