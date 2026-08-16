"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const groups = [
  {label:"CORE", items:[['/','Dashboard'],['/live','Live Evaluation']]},
  {label:"EVALUATE", items:[['/benchmarks','50-Case Benchmark'],['/runs','Runs']]},
  {label:"MODELS", items:[['/models','Model Registry'],['/models/performance','Performance']]},
  {label:"RELIABILITY", items:[['/health','Provider Health'],['/failures','Failures'],['/traces','Traces']]},
];

export default function Sidebar(){
 const pathname=usePathname();
 return <aside className="sidebar"><div className="brand"><div className="brandMark">A</div><div><div className="brandTitle">Agent Eval</div><div className="brandSub">Router · Control Plane</div></div></div><nav className="navGroups">{groups.map(g=><div className="navGroup" key={g.label}><div className="navLabel">{g.label}</div>{g.items.map(([href,label])=>{const active=pathname===href || (href!=="/"&&pathname.startsWith(href+"/"));return <Link key={href} href={href} className={`navItem ${active?"active":""}`}>{label}</Link>})}</div>)}<div className="navGroup navGroupBottom"><div className="navLabel">SYSTEM</div><Link href="/settings" className={`navItem ${pathname==="/settings"?"active":""}`}>Configuration</Link></div></nav></aside>
}
