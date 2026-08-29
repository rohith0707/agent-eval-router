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


_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "in", "is", "it", "of", "on", "or", "that", "the", "then", "to",
    "was", "were", "what", "with",
}
_NEGATION = {"no", "not", "never", "without", "cannot", "can't", "dont", "don't"}


def evaluate_text(
    output: str,
    expected: str | None = None,
    required_terms: list[str] | None = None,
) -> EvaluationScore:
    """Evaluate output with deterministic reference-aware checks.

    Failure precedence is explicit so CI and telemetry receive stable categories:
    empty output, contradiction, structured-contract violation, reference mismatch,
    then required-term failure.
    """
    text = output.strip()
    if not text:
        return EvaluationScore(0.0, 0.0, 0.0, False, False, "EMPTY_OUTPUT")

    structured = _structured_output_is_valid(text, expected)
    correctness = _reference_similarity(text, expected) if expected else 1.0
    relevance = _required_term_coverage(text, required_terms)
    contradiction = _has_reference_contradiction(text, expected)
    groundedness = min(correctness, relevance if required_terms else correctness)

    if contradiction:
        return EvaluationScore(0.0, relevance, 0.0, structured, False, "CONTRADICTS_REFERENCE")
    if not structured:
        return EvaluationScore(correctness, relevance, groundedness, False, False, "INVALID_STRUCTURED_OUTPUT")
    if expected and correctness < 0.8:
        return EvaluationScore(correctness, relevance, groundedness, True, False, "EXPECTED_MISMATCH")
    if required_terms and relevance < 0.8:
        return EvaluationScore(correctness, relevance, groundedness, True, False, "REQUIRED_TERM_MISSING")

    return EvaluationScore(correctness, relevance, groundedness, True, True, None)


def _reference_similarity(output: str, expected: str | None) -> float:
    if not expected:
        return 1.0

    expected_normalized = " ".join(expected.strip().casefold().split())
    output_normalized = " ".join(output.casefold().split())
    if output_normalized == expected_normalized:
        return 1.0

    expected_tokens = _meaningful_tokens(expected_normalized)
    output_tokens = _meaningful_tokens(output_normalized)
    if not expected_tokens:
        return 0.0

    expected_numbers = set(re.findall(r"\d+(?:\.\d+)?", expected_normalized))
    output_numbers = set(re.findall(r"\d+(?:\.\d+)?", output_normalized))
    if expected_numbers and not expected_numbers.issubset(output_numbers):
        return 0.0

    return len(expected_tokens & output_tokens) / len(expected_tokens)


def _required_term_coverage(output: str, required_terms: list[str] | None) -> float:
    if not required_terms:
        return 1.0
    normalized = " ".join(output.casefold().split())
    hits = sum(1 for term in required_terms if _term_present(normalized, term))
    return hits / len(required_terms)


def _term_present(output: str, term: str) -> bool:
    term_normalized = " ".join(term.casefold().split())
    return bool(re.search(rf"(?<!\w){re.escape(term_normalized)}(?!\w)", output))


def _has_reference_contradiction(output: str, expected: str | None) -> bool:
    if not expected:
        return False
    normalized = " ".join(output.casefold().split())
    expected_normalized = " ".join(expected.casefold().split())
    if not _term_present(normalized, expected_normalized):
        return False

    words = normalized.split()
    target = expected_normalized.split()
    width = len(target)
    for index in range(len(words) - width + 1):
        if words[index : index + width] != target:
            continue
        context = words[max(0, index - 3) : index]
        if any(token in _NEGATION for token in context):
            return True
    return False


def _structured_output_is_valid(output: str, expected: str | None) -> bool:
    if expected and expected.lstrip().startswith(("{", "[")):
        import json
        try:
            json.loads(output)
            return True
        except (TypeError, ValueError):
            return False
    return True


def _meaningful_tokens(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+(?:['.-][a-z0-9]+)*", text.casefold())
    return {token for token in tokens if token not in _STOPWORDS}


__all__ = ["EvaluationScore", "evaluate_text"]
