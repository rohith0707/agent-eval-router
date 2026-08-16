from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict
from typing import Iterable

from app.evaluation.runner import CaseResult


def summarize(results: Iterable[CaseResult]) -> dict:
    rows = list(results)
    if not rows:
        return {"cases": 0, "pass_rate": 0.0, "avg_score": 0.0, "avg_latency_ms": 0.0, "total_cost": 0.0}

    by_category: dict[str, list[CaseResult]] = defaultdict(list)
    for row in rows:
        by_category[row.category].append(row)

    return {
        "cases": len(rows),
        "pass_rate": sum(r.passed for r in rows) / len(rows),
        "avg_score": sum(r.score for r in rows) / len(rows),
        "avg_latency_ms": sum(r.latency_ms for r in rows) / len(rows),
        "p95_latency_ms": _percentile([r.latency_ms for r in rows], 0.95),
        "total_cost": sum(r.cost for r in rows),
        "cost_per_case": sum(r.cost for r in rows) / len(rows),
        "categories": {
            category: {
                "cases": len(items),
                "pass_rate": sum(r.passed for r in items) / len(items),
                "avg_score": sum(r.score for r in items) / len(items),
            }
            for category, items in sorted(by_category.items())
        },
        "results": [asdict(r) for r in rows],
    }


def _percentile(values: list[int], percentile: float) -> float:
    values = sorted(values)
    if not values:
        return 0.0
    index = min(len(values) - 1, max(0, round((len(values) - 1) * percentile)))
    return float(values[index])
