from __future__ import annotations

from .models import ModelCandidate, RoutingDecision

# v0.1 historical/fixture profiles. These are routing priors, not live measurements.
# They are replaced/updated by benchmark results in the adaptive-routing path.
DEFAULT_CANDIDATES = [
    ModelCandidate(provider="openai", model="gpt-5-mini", quality=0.918, latency_ms=1420, cost=0.014, reliability=0.962),
    ModelCandidate(provider="anthropic", model="claude-sonnet-4-5", quality=0.952, latency_ms=1880, cost=0.021, reliability=0.971),
    ModelCandidate(provider="ollama", model="llama3.2", quality=0.874, latency_ms=760, cost=0.002, reliability=0.914),
]


def route(
    quality_threshold: float,
    latency_budget_ms: int,
    cost_budget: float,
    candidates: list[ModelCandidate] | None = None,
) -> RoutingDecision:
    candidates = candidates or DEFAULT_CANDIDATES
    eligible = [
        candidate
        for candidate in candidates
        if candidate.quality >= quality_threshold
        and candidate.latency_ms <= latency_budget_ms
        and candidate.cost <= cost_budget
    ]
    if not candidates:
        raise ValueError("No model candidates are registered")

    selected = max(eligible or candidates, key=lambda candidate: (candidate.quality, -candidate.latency_ms))
    passed = bool(eligible)
    reason = (
        f"Selected {selected.model}: highest-quality candidate within the quality, latency, and cost constraints."
        if passed
        else f"No candidate satisfied every constraint; selected {selected.model} as the highest-quality fallback."
    )
    return RoutingDecision(selected=selected, eligible=eligible, passed=passed, reason=reason)
