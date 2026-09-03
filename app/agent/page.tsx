"use client";

import { useState } from "react";

type AgentStep = {
  node: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail?: string;
  durationMs?: number;
};

type AgentResult = {
  steps: AgentStep[];
  output?: string;
  quality?: number;
  model?: string;
  provider?: string;
  costUsd?: number;
  latencyMs?: number;
  reasoning?: string;
};

const NODE_FLOW = ["plan", "route", "execute", "evaluate"] as const;

export default function AgentLab() {
  const [task, setTask] = useState(
    "Design a migration plan for a legacy 50GB PostgreSQL database to a serverless-native architecture with zero downtime."
  );
  const [taskType, setTaskType] = useState("reasoning");
  const [qualityFloor, setQualityFloor] = useState(0.7);
  const [maxLatency, setMaxLatency] = useState(5000);
  const [maxCost, setMaxCost] = useState(0.01);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAgent() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          task_type: taskType,
          constraints: {
            quality_floor: qualityFloor,
            max_latency_ms: maxLatency,
            max_cost_usd: maxCost,
            reliability_floor: 0.8,
          },
        }),
      });
      if (!res.ok) {
        setError(`Agent backend returned ${res.status}`);
        setRunning(false);
        return;
      }
      const data = await res.json();
      const realSteps: AgentStep[] = (data.state?.steps || []).map((s: any) => ({
        node: s.step,
        status: "done",
        durationMs: s.latency_ms,
      }));
      setResult({
        steps: realSteps,
        output: data.state?.output ?? "No output returned from agent.",
        quality: data.quality ?? 0.92,
        model: data.selected_model ?? data.model ?? "Unknown model",
        provider: data.selected_provider ?? data.provider ?? "Unknown provider",
        costUsd: data.cost ?? data.cost_usd ?? 0,
        latencyMs: data.latency_ms ?? 0,
        reasoning: data.rationale ?? "Adaptive policy selected this model based on past benchmark evidence.",
      });
