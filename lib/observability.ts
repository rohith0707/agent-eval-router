export type ExecutionEvidence = {
  runId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  fallbackCount: number;
  evaluationQuality: number;
  status: "passed" | "degraded" | "failed";
};

export function normalizeExecutionEvidence(input: Partial<ExecutionEvidence> & Pick<ExecutionEvidence, "runId" | "model" | "provider">): ExecutionEvidence {
  return {
    runId: input.runId,
    model: input.model,
    provider: input.provider,
    inputTokens: Math.max(0, input.inputTokens ?? 0),
    outputTokens: Math.max(0, input.outputTokens ?? 0),
    latencyMs: Math.max(0, input.latencyMs ?? 0),
    costUsd: Math.max(0, input.costUsd ?? 0),
    fallbackCount: Math.max(0, input.fallbackCount ?? 0),
    evaluationQuality: Math.min(1, Math.max(0, input.evaluationQuality ?? 0)),
    status: input.status ?? "failed",
  };
}
