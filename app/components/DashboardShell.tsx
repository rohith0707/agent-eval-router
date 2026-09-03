"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

type BuildMeta = {
  commit: string;
  ref: string;
  environment: string;
  deploymentUrl: string | null;
};

function shortSha(value: string): string {
  return value === "local" ? value : value.slice(0, 7);
}

export default function DashboardShell({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [build, setBuild] = useState<BuildMeta | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/meta", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: BuildMeta | null) => {
        if (active) setBuild(payload);
      })
      .catch(() => {
        if (active) setBuild(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app">
      <div className="shell">
        <Sidebar />
        <main className="main">
          <header className="header">
            <div>
              <div className="crumb">Agent Eval Router / {eyebrow ?? title}</div>
              <h1 className="h1">{title}</h1>
            </div>
            {action}
          </header>
          <div className="content">{children}</div>
          <footer className="content" style={{ paddingTop: 0, paddingBottom: 18 }}>
            <div className="sectionSub" style={{ fontSize: 11, opacity: 0.8 }}>
              Build {build ? shortSha(build.commit) : "checking…"} · {build?.ref ?? "main"} · {build?.environment ?? "production"}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
