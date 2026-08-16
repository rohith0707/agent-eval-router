"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const items=[
 {href:"/",label:"Dashboard"},
 {href:"/live",label:"Live Evaluation"},
 {href:"/benchmarks",label:"50-Case Benchmark"},
 {href:"/runs",label:"Runs"},
 {href:"/models",label:"Models"},
 {href:"/health",label:"Reliability"},
 {href:"/settings",label:"Configuration"},
];

export default function Sidebar(){const pathname=usePathname();return <aside className="sidebar"><div className="brand"><div className="brandMark">A</div><div><div className="brandTitle">Agent Eval</div><div className="brandSub">Router · Control Plane</div></div></div><nav className="navGroups">{items.map(item=>{const active=item.href==="/"?pathname==="/":pathname===item.href||pathname.startsWith(item.href+"/");return <Link key={item.href} href={item.href} className={`navItem ${active?"active":""}`}>{item.label}</Link>})}</nav></aside>}
