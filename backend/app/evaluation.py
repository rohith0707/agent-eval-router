from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(slots=True)
class EvaluationScore:
    correctness: float
    relevance: float
    groundedness: float
    structured_output_valid: bool
    passed: bool
    failure_type: str | None


def evaluate_text(output: str, expected: str | None = None, required_terms: list[str] | None = None) -> EvaluationScore:
    text = output.strip()
    if not text:
        return EvaluationScore(0, 0, 0, False, False, "EMPTY_OUTPUT")
    correctness = 1.0
    if expected:
        correctness = 1.0 if text.casefold() == expected.strip().casefold() else 0.0
    relevance = 1.0
    if required_terms:
        hits = sum(1 for term in required_terms if re.search(re.escape(term), text, re.I))
        relevance = hits / len(required_terms)
    groundedness = relevance
    structured = True
    passed = correctness >= 0.8 and relevance >= 0.8
    failure = None if passed else "QUALITY_FAILURE"
    return EvaluationScore(correctness, relevance, groundedness, structured, passed, failure)
