"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const coreItems = [
  { href: "/", label: "Overview", description: "System command center" },
  { href: "/live", label: "Evaluation Lab", description: "Run and compare tasks" },
  { href: "/benchmarks", label: "Evaluation Cases", description: "Benchmark and regressions" },
  { href: "/models", label: "Routing Intelligence", description: "Models and decisions" },
  { href: "/runs", label: "Trace Explorer", description: "Evidence and traces" },
  { href: "/evidence", label: "Evidence Comparison", description: "Phase 3 evidence replay" },
  { href: "/agent", label: "Agent Lab", description: "Stateful agent lab" },
];

const systemItems = [
  { href: "/health", label: "Reliability" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brandMark">A</div>
        <div>
          <div className="brandTitle">Agent Eval</div>
          <div className="brandSub">Quality · Routing · Reliability</div>
        </div>
      </div>

      <nav className="navGroups">
        <div className="navGroup">
          <div className="navLabel">CONTROL PLANE</div>
          {coreItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navItem ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.description}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="navGroup navGroupBottom">
          <div className="navLabel">SYSTEM</div>
          {systemItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`navItem ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="sidebarFooter">
        <div className="sidebarStatus"><span className="statusDot ok">●</span> Evidence pipeline active</div>
      </div>
    </aside>
  );
}
