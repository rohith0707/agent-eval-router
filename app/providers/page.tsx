"use client";
import { useState, useEffect } from "react";
import { configuredProviders, modelRegistry } from "@/lib/providers";

type ProviderInfo = {
  name: string;
  status: "ready" | "needs_setup" | "degraded";
  models: number;
  lastCheck?: string;
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const configured = configuredProviders();
    const registry = modelRegistry();
    const info: ProviderInfo[] = Object.entries(registry).map(([name, models]) => ({
      name,
      status: configured[name] ? "ready" : "needs_setup",
      models: (models as string[]).length,
    }));
    setProviders(info);
    setLoading(false);
  }, []);

  return (
    <div className="content">
      <header className="header">
        <div className="crumb">Agent Eval Router / Providers</div>
        <h1 className="h1">Provider Registry</h1>
        <p className="sectionSub">
          Registered AI providers and their credential status.
          Credentials stay server-side — never exposed to the browser.
        </p>
      </header>

      <section className="card">
        <h2 className="sectionTitle">Configured Providers</h2>
        {loading ? (
          <p className="sectionSub">Checking providers…</p>
        ) : (
          <div className="providerGrid">
            {providers.map((p) => (
              <div key={p.name} className="card">
                <div className="topRow">
                  <div>
                    <div className="metricLabel">{p.name}</div>
                    <h3 className="cardTitle">{p.models} candidate models</h3>
                  </div>
                  <span className={`statusDot ${p.status === "ready" ? "ok" : "muted"}`}>
                    {p.status === "ready" ? "Ready" : "Needs setup"}
                  </span>
                </div>
                <div className="kv">
                  <span>Models</span>
                  <strong>{p.models}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pageFooter">
        <a href="/" className="textLink">← Back to overview</a>
        <a href="/health" className="textLink">Provider Health →</a>
      </div>
    </div>
  );
}
