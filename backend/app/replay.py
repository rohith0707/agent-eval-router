from __future__ import annotations

from .models import ConstraintSet, EvidenceRow, ModelCandidate, ReplayResult
from .router import DEFAULT_CANDIDATES, _passes_constraints, score_candidate, select_with_constraints


class ReplayEngine:
    def __init__(self, candidates: list[ModelCandidate] | None = None):
        self.candidates = candidates or DEFAULT_CANDIDATES

    async def replay_route(self, task: str, task_type: str, constraints: ConstraintSet,
                           evidence: list[EvidenceRow] | None = None,
                           alternative_constraints: ConstraintSet | None = None,
                           actual: dict | None = None) -> ReplayResult:
        evidence = evidence or []
        counter = replay_route(task, task_type, alternative_constraints or constraints, self.candidates, evidence)
        if actual is None:
            actual_decision = replay_route(task, task_type, constraints, self.candidates, evidence)
            actual = {"provider": actual_decision.provider, "model": actual_decision.model, "confidence_score": actual_decision.confidence_score}
        delta = {
            "model_changed": actual.get("model") != counter.model,
            "provider_changed": actual.get("provider") != counter.provider,
            "confidence_delta": counter.confidence_score - float(actual.get("confidence_score", 0.0)),
        }
        counter.actual = actual
        counter.counterfactual = {"provider": counter.provider, "model": counter.model,
                                   "confidence_score": counter.confidence_score,
                                   "evidence_used": counter.evidence_used}
        counter.delta = delta
        return counter


def replay_route(task: str, task_type: str, constraints: ConstraintSet,
                 candidates: list[ModelCandidate] | None = None,
                 evidence: list[EvidenceRow] | None = None) -> ReplayResult:
    """Pure deterministic replay. It never executes a model or external tool."""
    candidates = candidates or DEFAULT_CANDIDATES
    evidence = evidence or []
    if not candidates:
        raise ValueError("No model candidates are registered")
    if not evidence:
        decision = select_with_constraints(constraints, candidates=candidates, evidence=[])
        return ReplayResult(provider=decision.selected.provider, model=decision.selected.model,
                            rationale=f"Replay: no evidence for task_type={task_type!r}; constraints-only.",
                            confidence_score=0.5, evidence_used=0, constraints=constraints)
    eligible = [c for c in candidates if _passes_constraints(c, constraints)]
    scored = sorted(eligible or candidates, key=lambda c: score_candidate(c, constraints, evidence), reverse=True)
    selected = scored[0]
    confidence = max(0.0, min(1.0, score_candidate(selected, constraints, evidence)))
    return ReplayResult(provider=selected.provider, model=selected.model,
                        rationale=(f"Counterfactual replay of {len(evidence)} historical runs for {task_type!r}; "
                                   f"selected {selected.model} using frozen evidence and constraints."),
                        confidence_score=confidence, evidence_used=len(evidence), constraints=constraints)
