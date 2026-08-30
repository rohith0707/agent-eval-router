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


# ── Phase 3: Constraint-Aware Evidence-Driven Scoring ────────────────────────


def _passes_constraints(candidate: ModelCandidate, constraints: ConstraintSet) -> bool:
    """Filter a candidate against quality/latency/cost/reliability constraints."""
    return (
        candidate.quality >= constraints.quality_floor
        and candidate.latency_ms <= constraints.max_latency_ms
        and candidate.cost <= constraints.max_cost_usd
        and candidate.reliability >= constraints.reliability_floor
    )


def score_candidate(
    candidate: ModelCandidate,
    constraints: ConstraintSet,
    evidence: list[EvidenceRow] | None = None,
) -> float:
    """Score a candidate against constraints and (optionally) historical evidence.

    Score is a weighted sum normalised to [0, 1]:
        - 0.40 quality_headroom  (quality above floor / 1.0)
        - 0.25 latency_headroom  (1 - latency / max_latency_ms, clamped to [0,1])
        - 0.20 cost_efficiency    (1 - cost / max_cost_usd, clamped to [0,1])
        - 0.15 reliability_score  (reliability)
    Evidence adjusts the score by averaging candidate's past performance on
    the same task_type (when at least 3 rows are available).
    """
    evidence = evidence or []
    quality_headroom = max(0.0, candidate.quality - constraints.quality_floor) + constraints.quality_floor
    latency_headroom = max(0.0, 1.0 - (candidate.latency_ms / max(constraints.max_latency_ms, 1)))
    cost_efficiency = max(0.0, 1.0 - (candidate.cost / max(constraints.max_cost_usd, 1e-9)))
    reliability_score = candidate.reliability

    base = (
        0.40 * quality_headroom
        + 0.25 * latency_headroom
        + 0.20 * cost_efficiency
        + 0.15 * reliability_score
    )

    if evidence:
        same_provider = [row for row in evidence if row.provider == candidate.provider and row.model == candidate.model]
        if len(same_provider) >= 3:
            past_quality = sum(row.quality for row in same_provider) / len(same_provider)
            past_latency = sum(row.latency_ms for row in same_provider) / len(same_provider)
            past_reliability = sum(row.reliability for row in same_provider) / len(same_provider)
            evidence_score = (
                0.5 * past_quality
                + 0.25 * (1.0 - past_latency / max(constraints.max_latency_ms, 1))
                + 0.25 * past_reliability
            )
            base = 0.7 * base + 0.3 * evidence_score

    return round(min(1.0, max(0.0, base)), 4)


def select_with_constraints(
    constraints: ConstraintSet,
    candidates: list[ModelCandidate] | None = None,
    evidence: list[EvidenceRow] | None = None,
) -> RoutingDecision:
    """Constraint-aware routing that uses historical evidence for scoring.

    Returns the highest-scoring candidate that satisfies the constraints.
    If no candidate satisfies the constraints, returns the highest-scoring
    candidate overall (with a 'no candidate satisfied' rationale).
    """
    candidates = candidates or DEFAULT_CANDIDATES
    if not candidates:
        raise ValueError("No model candidates are registered")

    eligible = [c for c in candidates if _passes_constraints(c, constraints)]
    evidence = evidence or []
    if eligible:
        scored = sorted(
            eligible,
            key=lambda c: score_candidate(c, constraints, evidence),
            reverse=True,
        )
        selected = scored[0]
        reason = (
            f"Constraint-aware selection of {selected.model}: scored {score_candidate(selected, constraints, evidence):.3f} "
            f"with {len(evidence)} evidence rows and constraints quality≥{constraints.quality_floor}, "
            f"latency≤{constraints.max_latency_ms}ms, cost≤${constraints.max_cost_usd}, reliability≥{constraints.reliability_floor}."
        )
        return RoutingDecision(selected=selected, eligible=eligible, passed=True, reason=reason)

    # Fallback: pick the highest-scoring candidate overall even if it does not meet constraints
    scored = sorted(
        candidates,
        key=lambda c: score_candidate(c, constraints, evidence),
        reverse=True,
    )
    selected = scored[0]
    reason = (
        f"No candidate satisfied every constraint; selected {selected.model} "
        f"(scored {score_candidate(selected, constraints, evidence):.3f}) as the highest-scoring fallback."
    )
    return RoutingDecision(selected=selected, eligible=[], passed=False, reason=reason)


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