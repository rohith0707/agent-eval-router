from __future__ import annotations

import logging
import os

from .models import (
    ConstraintSet,
    EvidenceRow,
    ModelCandidate,
    ReplayResult,
)
from .router import (
    DEFAULT_CANDIDATES,
    _passes_constraints,
    score_candidate,
    select_with_constraints,
)

logger = logging.getLogger(__name__)


def replay_route(
    task: str,
    task_type: str,
    constraints: ConstraintSet,
    candidates: list[ModelCandidate] | None = None,
    evidence: list[EvidenceRow] | None = None,
) -> ReplayResult:
    """Offline replay: pick the best route using historical evidence only.

    Deterministic from the evidence store, no live model calls.
    """
    candidates = candidates or DEFAULT_CANDIDATES
    if not candidates:
        raise ValueError("No model candidates are registered")

    evidence = evidence or []
    if not evidence:
        # ponytail: graceful no-evidence fallback (reuses constraint-only path)
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


class ReplayEngine:
    """DB-backed evidence fetcher. Returns empty list when DB is unconfigured."""

    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url or os.environ.get("DATABASE_URL")

    async def fetch_evidence(self, task_type: str, limit: int = 20) -> list[EvidenceRow]:
        if not self.database_url:
            logger.info("ReplayEngine: no DB configured; returning empty evidence")
            return []
        try:
            import asyncpg
        except ImportError:
            logger.info("ReplayEngine: asyncpg not installed; returning empty evidence")
            return []
        try:
            conn = await asyncpg.connect(self.database_url)
            try:
                rows = await conn.fetch(
                    "SELECT category, selected_model, quality, latency_ms, cost, reliability, status FROM evaluation_runs WHERE category=$1 ORDER BY created_at DESC LIMIT $2",
                    task_type, limit,
                )
            finally:
                await conn.close()
        except Exception as exc:
            logger.warning("ReplayEngine: DB query failed: %s", exc)
            return []
        return [
            EvidenceRow(
                task_type=r["category"] or "auto",
                provider=r["selected_model"] or "unknown",
                model=r["selected_model"] or "unknown",
                quality=float(r["quality"] or 0.0),
                latency_ms=int(r["latency_ms"] or 0),
                cost_usd=float(r["cost"] or 0.0),
                reliability=float(r["reliability"] or 1.0),
                passed=bool(r["status"] == "passed"),
            )
            for r in rows
        ]

    async def replay_route(
        self,
        task: str,
        task_type: str,
        constraints: ConstraintSet,
    ) -> ReplayResult:
        evidence = await self.fetch_evidence(task_type=task_type)
        return replay_route(
            task=task,
            task_type=task_type,
            constraints=constraints,
            candidates=DEFAULT_CANDIDATES,
            evidence=evidence,
        )
