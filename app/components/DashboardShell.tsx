"use client";
import Sidebar from "./Sidebar";

export default function DashboardShell({title,eyebrow,action,children}:{title:string;eyebrow?:string;action?:React.ReactNode;children:React.ReactNode}){return <div className="app"><div className="shell"><Sidebar/><main className="main"><header className="header"><div><div className="crumb">Agent Eval Router / {eyebrow ?? title}</div><h1 className="h1">{title}</h1></div>{action}</header><div className="content">{children}</div></main></div></div>}
