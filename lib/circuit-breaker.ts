/**
 * Phase 3 — Circuit Breaker for LLM providers.
 *
 * Opens a provider circuit for rate-limit/credit signals (429/402) so
 * repeated calls do not amplify an already-limited provider. Authentication,
 * endpoint, and transient server errors remain eligible for normal fallback.
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

const DEFAULT_COOLDOWN_MS = 60_000;
const FAILURE_THRESHOLD = 1;

/** Only rate-limit/credit responses should poison a provider circuit. */
export function shouldTripCircuit(statusCode?: number): boolean {
  return statusCode === 402 || statusCode === 429;
}

class CircuitBreaker {
  private readonly state = new Map<ProviderName, BreakerState>();

  constructor(private readonly cooldownMs: number = DEFAULT_COOLDOWN_MS) {}

  isOpen(provider: ProviderName): boolean {
    const entry = this.state.get(provider);
    if (!entry) return false;
    if (Date.now() >= entry.opensUntil) {
      this.state.delete(provider);
      return false;
    }
    return true;
  }

  recordSuccess(provider: ProviderName): void {
    this.state.delete(provider);
  }

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
