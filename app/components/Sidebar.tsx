"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", description: "Latest routing decision" },
  { href: "/evidence", label: "Evidence", description: "Decision trail & EvidenceRank" },
  { href: "/agent", label: "Agent Studio", description: "Plan-Route-Execute-Evaluate pipeline" },
  { href: "/settings", label: "Settings", description: "API keys & configuration" },
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
          <div className="brandSub">Evidence-Based LLM Routing</div>
        </div>
      </div>

      <nav className="navGroups">
        <div className="navGroup">
          <div className="navLabel">DECISION PLANE</div>
          {navItems.map((item) => {
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
      </nav>

      <div className="sidebarFooter">
        <div className="sidebarStatus">
          <span className="statusDot ok">●</span> EvidenceRank active
        </div>
      </div>
    </aside>
  );
}
