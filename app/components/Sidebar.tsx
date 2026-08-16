"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { label: "CORE", items: [{ href: "/", label: "Dashboard" }, { href: "/live", label: "Live Evaluation" }] },
  { label: "EVALUATION", items: [{ href: "/runs", label: "Runs" }, { href: "/benchmarks", label: "Benchmarks" }, { href: "/datasets", label: "Datasets" }] },
  { label: "MODELS", items: [{ href: "/models", label: "Model Registry" }, { href: "/models/performance", label: "Performance" }] },
  { label: "ROUTING", items: [{ href: "/routing", label: "Decisions" }, { href: "/routing/policies", label: "Policies" }] },
  { label: "RELIABILITY", items: [{ href: "/health", label: "Provider Health" }, { href: "/failures", label: "Failures" }] },
  { label: "OBSERVABILITY", items: [{ href: "/traces", label: "Traces" }, { href: "/latency", label: "Latency" }, { href: "/cost", label: "Cost & Usage" }] },
  { label: "REPORTING", items: [{ href: "/reports", label: "Reports" }] },
  { label: "SYSTEM", items: [{ href: "/settings", label: "Configuration" }] },
];

export default function Sidebar() {
  const pathname = usePathname();
  return <aside className="sidebar"><div className="brand"><div className="brandMark">A</div><div><div className="brandTitle">Agent Eval</div><div className="brandSub">Router · Control Plane</div></div></div><nav className="navGroups">{sections.map(section => <div key={section.label} className="navGroup"><div className="navLabel">{section.label}</div>{section.items.map(item => { const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")); return <Link key={item.href} href={item.href} className={`navItem ${active ? "active" : ""}`}>{item.label}</Link>; })}</div>)}</nav></aside>;
}
