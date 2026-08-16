import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Agent Eval Router", description: "Benchmark-driven routing and evaluation for LLM workloads." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
