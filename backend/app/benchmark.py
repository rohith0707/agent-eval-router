from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .evaluation import evaluate_text


DATASET = Path(__file__).resolve().parents[2] / "datasets" / "benchmark-v1.jsonl"


def load_cases() -> list[dict[str, Any]]:
    with DATASET.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def score_outputs(outputs: dict[str, str]) -> dict[str, Any]:
    cases = load_cases()
    results = []
    for case in cases:
        score = evaluate_text(outputs.get(case["id"], ""), case.get("expected"), case.get("required_terms"))
        results.append({"id": case["id"], "category": case["category"], "passed": score.passed, "failure_type": score.failure_type, "correctness": score.correctness, "relevance": score.relevance})
    passed = sum(item["passed"] for item in results)
    return {"total": len(results), "passed": passed, "pass_rate": passed / len(results) if results else 0, "results": results}
