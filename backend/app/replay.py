from __future__ import annotations

from .models import (
    ConstraintSet,
    EvidenceRow,
    ModelCandidate,
    ReplayResult,
    RoutingDecision,
)

# v0.1 historical/fixture profiles. These are routing priors, not live measurements.
# They are replaced/updated by benchmark results in the adaptive-routing path.
DEFAULT_CANDIDATES = [
    ModelCandidate(provider="openai", model="gpt-5-mini", quality=0.918, latency_ms=1420, cost=0.014, reliability=0.962),
    ModelCandidate(provider="anthropic", model="claude-sonnet-4-5", quality=0.952, latency_ms=1880, cost=0.021, reliability=0.971),
    ModelCandidate(provider="ollama", model="llama3.2", quality=0.874, latency_ms=760, cost=0.002, reliability=0.914),
]


def replay_route(
    task: str,
    task_type: str,
    constraints: ConstraintSet,
    candidates: list[ModelCandidate] | None = None,
    evidence: list[EvidenceRow] | None = None,
) -> ReplayResult:
    """Offline replay: pick the best route using historical evidence only.

    Unlike `select_with_constraints`, the decision is purely deterministic
    from the evidence store, without re-running the model. This is useful
    for A/B comparisons: how would my routing have behaved against past runs?
    """
    candidates = candidates or DEFAULT_CANDIDATES
    if not candidates:
        raise ValueError("No model candidates are registered")

    evidence = evidence or []
    if not evidence:
        # Graceful fallback: route with the constraints only, no evidence.
        decision = select_with_constraints(constraints, candidates=candidates, evidence=[])
        return ReplayResult(
            provider=decision.selected.provider,
            model=decision.selected.model,
            rationale=f"Replay: no evidence available for task_type={task_type!r}; used constraints-only decision: {decision.reason}",
            confidence_score=0.5,
            evidence_used=0,
            constraints=constraints,
        )

    eligible = [c for c in candidates if _passes_constraints(c, constraints)]
    scored = sorted(
        eligible or candidates,
        key=lambda c: score_candidate(c, constraints, evidence),
        reverse=True,
    )
    selected = scored[0]
    confidence = score_candidate(selected, constraints, evidence)
    rationale = (
        f"Replay of {len(evidence)} historical runs for task_type={task_type!r}: "
        f"selected {selected.model} (scored {confidence:.3f}). "
        f"Constraint: quality≥{constraints.quality_floor}, latency≤{constraints.max_latency_ms}ms, "
        f"cost≤${constraints.max_cost_usd}, reliability≥{constraints.reliability_floor}."
    )
    return ReplayResult(
        provider=selected.provider,
        model=selected.model,
        rationale=rationale,
        confidence_score=confidence,
        evidence_used=len(evidence),
        constraints=constraints,
    )