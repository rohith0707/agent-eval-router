/**
 * Phase 3 — Circuit Breaker for LLM providers.
 *
 * Detects when a provider hits 429/402/403 and "opens" the circuit for that
 * provider for a configurable cool-down window. All subsequent calls to that
 * provider are skipped until the window elapses.
 *
 * This module is shared by the benchmark route and the production cascade so
 * a single rate-limit hit propagates everywhere instead of being re-encountered.
 */

type ProviderName = "gemini" | "huggingface" | "nvidia" | "openrouter";

type BreakerState = {
  /** epoch ms when the circuit will close again (i.e. cool-down ends) */
  opensUntil: number;
  /** count of recent failures that triggered the trip */
  failures: number;
  /** last reason the circuit opened */
  lastReason?: string;
};

const DEFAULT_COOLDOWN_MS = 60_000; // 60s by default; enough to clear a 429 window.
const FAILURE_THRESHOLD = 1; // a single 429/402 is enough to open the circuit.

class CircuitBreaker {
  private readonly state = new Map<ProviderName, BreakerState>();

  constructor(private readonly cooldownMs: number = DEFAULT_COOLDOWN_MS) {}

  /** Returns true if a request to this provider is currently allowed. */
  isOpen(provider: ProviderName): boolean {
    const entry = this.state.get(provider);
    if (!entry) return false;
    if (Date.now() >= entry.opensUntil) {
      this.state.delete(provider);
      return false;
    }
    return true;
  }

  /** Record a successful call (resets the breaker). */
  recordSuccess(provider: ProviderName): void {
    this.state.delete(provider);
  }

  /** Record a failure that may trip the circuit. */
  recordFailure(provider: ProviderName, reason: string): void {
    const existing = this.state.get(provider);
    const failures = (existing?.failures ?? 0) + 1;
    if (failures >= FAILURE_THRESHOLD) {
      this.state.set(provider, {
        opensUntil: Date.now() + this.cooldownMs,
        failures,
        lastReason: reason,
      });
    } else {
      this.state.set(provider, { ...existing!, failures });
    }
  }

  /** Snapshot of all open circuits (used by /api/health and the benchmark route). */
  snapshot(): Record<ProviderName, { open: boolean; opensUntil: number; lastReason?: string }> {
    const result = {} as Record<ProviderName, { open: boolean; opensUntil: number; lastReason?: string }>;
    for (const provider of ["gemini", "huggingface", "nvidia", "openrouter"] as ProviderName[]) {
      const entry = this.state.get(provider);
      result[provider] = {
        open: entry ? Date.now() < entry.opensUntil : false,
        opensUntil: entry?.opensUntil ?? 0,
        lastReason: entry?.lastReason,
      };
    }
    return result;
  }
}

let shared: CircuitBreaker | null = null;

export function circuitBreaker(): CircuitBreaker {
  if (!shared) {
    shared = new CircuitBreaker(
      Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS) || DEFAULT_COOLDOWN_MS,
    );
  }
  return shared;
}

export function isProviderTripped(provider: ProviderName): boolean {
  return circuitBreaker().isOpen(provider);
}

export function markProviderSuccess(provider: ProviderName): void {
  circuitBreaker().recordSuccess(provider);
}

export function markProviderFailure(provider: ProviderName, reason: string): void {
  circuitBreaker().recordFailure(provider, reason);
}

export function getCircuitSnapshot() {
  return circuitBreaker().snapshot();
}

export type { ProviderName };
