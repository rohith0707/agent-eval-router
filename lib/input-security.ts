export const MAX_TASK_LENGTH = 12_000;
export const MAX_OUTPUT_LENGTH = 32_000;

export function normalizeTaskInput(value: unknown): { task: string; truncated: boolean } {
  if (typeof value !== "string") return { task: "", truncated: false };
  const trimmed = value.trim();
  return { task: trimmed.slice(0, MAX_TASK_LENGTH), truncated: trimmed.length > MAX_TASK_LENGTH };
}

export function redactSecrets(value: string): string {
  return value
    .replace(/(api[_-]?key|token|authorization|secret)\s*[:=]\s*[^\s,}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

export function limitOutput(value: string): string {
  return value.length <= MAX_OUTPUT_LENGTH ? value : `${value.slice(0, MAX_OUTPUT_LENGTH)}…`;
}
