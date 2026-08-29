export type RetryableFailure = "timeout" | "rate_limit" | "server_error";

export type RetryPolicy = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export function isRetryableFailure(failure: string): failure is RetryableFailure {
  return failure === "timeout" || failure === "rate_limit" || failure === "server_error";
}

export function retryDelayMs(attempt: number, policy: RetryPolicy): number {
  if (attempt < 1) return 0;
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.min(attempt - 1, 10));
}

export function canRetry(attemptsUsed: number, policy: RetryPolicy): boolean {
  return attemptsUsed < Math.max(0, policy.maxRetries);
}
