"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Overview" },
  { href: "/live", label: "Evaluate" },
  { href: "/benchmarks", label: "Benchmark" },
  { href: "/models", label: "Models" },
  { href: "/health", label: "Reliability" },
  { href: "/runs", label: "Evidence" },
];

export default function Sidebar() {
  const pathname = usePathname();

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
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
      </nav>

      <div className="sidebarFooter">
        <Link href="/settings" className="navItem secondaryNavItem">
          Settings
        </Link>
      </div>
    </aside>
  );
}
