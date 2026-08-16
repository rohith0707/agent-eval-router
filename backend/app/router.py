from .models import ModelCandidate, RoutingDecision


DEFAULT_CANDIDATES = [
    ModelCandidate(model="GPT-5", quality=0.918, latency_ms=1420, cost=0.014, reliability=0.962),
    ModelCandidate(model="Claude Sonnet", quality=0.952, latency_ms=1880, cost=0.021, reliability=0.971),
    ModelCandidate(model="Local Llama", quality=0.874, latency_ms=760, cost=0.002, reliability=0.914),
]


def route(
    quality_threshold: float,
    latency_budget_ms: int,
    cost_budget: float,
    candidates: list[ModelCandidate] = DEFAULT_CANDIDATES,
) -> RoutingDecision:
    eligible = [
        candidate
        for candidate in candidates
        if candidate.quality >= quality_threshold
        and candidate.latency_ms <= latency_budget_ms
        and candidate.cost <= cost_budget
    ]
    selected = max(eligible or candidates, key=lambda candidate: (candidate.quality, -candidate.latency_ms))
    passed = bool(eligible)
    reason = (
        f"Selected {selected.model}: highest quality within the quality, latency, and cost constraints."
        if passed
        else f"No candidate satisfied every constraint; selected {selected.model} as the highest-quality fallback."
    )
    return RoutingDecision(selected=selected, eligible=eligible, passed=passed, reason=reason)
