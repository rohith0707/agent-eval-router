import type { ProviderName } from "./providers";

export type AgentTaskType =
  | "reasoning"
  | "structured_output"
  | "tool_calling"
  | "rag"
  | "agent_planning"
  | "reliability"
  | "text_to_sql"
  | "safety"
  | "code_generation"
  | "general";

export type AgentExecutionPlan = Readonly<{
  taskType: AgentTaskType;
  preferredProviders: ProviderName[];
  routeBeforeInference: true;
  requiresTool: boolean;
  maxSteps: number;
}>;

function normalize(task: string): string {
  return task.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildExecutionPlan(task: string): AgentExecutionPlan {
  const text = normalize(task);
  const plan: {
    taskType: AgentTaskType;
    preferredProviders: ProviderName[];
    routeBeforeInference: true;
    requiresTool: boolean;
    maxSteps: number;
  } = {
    taskType: "general",
    preferredProviders: ["openrouter", "nvidia", "gemini", "huggingface"],
    routeBeforeInference: true,
    requiresTool: false,
    maxSteps: 1,
  };

  if (/sql|database|query|tenant_id|read-only/.test(text)) {
    plan.taskType = "text_to_sql";
    plan.preferredProviders = ["nvidia", "openrouter", "gemini", "huggingface"];
  } else if (/weather|tool|api call|function call|invoke/.test(text)) {
    plan.taskType = "tool_calling";
    plan.preferredProviders = ["openrouter", "nvidia", "gemini", "huggingface"];
    plan.requiresTool = true;
    plan.maxSteps = 4;
  } else if (/rag|retriev|knowledge base|grounded|citation/.test(text)) {
    plan.taskType = "rag";
    plan.preferredProviders = ["openrouter", "gemini", "nvidia", "huggingface"];
  } else if (/agent|plan|multi-step|multi step|workflow/.test(text)) {
    plan.taskType = "agent_planning";
    plan.preferredProviders = ["openrouter", "nvidia", "gemini", "huggingface"];
    plan.requiresTool = /tool|api|search|database/.test(text);
    plan.maxSteps = plan.requiresTool ? 6 : 3;
  } else if (/safety|prompt injection|jailbreak|pii|authorization|password/.test(text)) {
    plan.taskType = "safety";
    plan.preferredProviders = ["nvidia", "openrouter", "gemini", "huggingface"];
  } else if (/json|structured output|schema|typed object/.test(text)) {
    plan.taskType = "structured_output";
    plan.preferredProviders = ["gemini", "nvidia", "openrouter", "huggingface"];
  } else if (/code|python|typescript|javascript|implement|debug/.test(text)) {
    plan.taskType = "code_generation";
    plan.preferredProviders = ["huggingface", "nvidia", "openrouter", "gemini"];
  } else if (/retry|timeout|fallback|rate limit|reliability|outage/.test(text)) {
    plan.taskType = "reliability";
    plan.preferredProviders = ["nvidia", "openrouter", "gemini", "huggingface"];
  } else if (/compare|trade-off|tradeoff|reason|why|architecture|design/.test(text)) {
    plan.taskType = "reasoning";
    plan.preferredProviders = ["openrouter", "nvidia", "gemini", "huggingface"];
  }

  return plan;
}
