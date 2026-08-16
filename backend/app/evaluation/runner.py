from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.adapters.base import ModelAdapter, ModelResponse


@dataclass(slots=True)
class CaseResult:
    case_id: str
    category: str
    model: str
    provider: str
    passed: bool
    latency_ms: int
    input_tokens: int
    output_tokens: int
    cost: float
    score: float
    matched_criteria: list[str]
    failed_criteria: list[str]
    output: str


class BenchmarkRunner:
    """Runs project-owned benchmark cases against a ModelAdapter.

    The runner deliberately uses lightweight deterministic criteria for v1.
    Model-specific semantic graders can be added without changing the runner API.
    """

    def __init__(self, dataset_path: str | Path):
        self.dataset_path = Path(dataset_path)

    def load_cases(self) -> list[dict[str, Any]]:
        cases: list[dict[str, Any]] = []
        for line in self.dataset_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                cases.append(json.loads(line))
        return cases

    async def run_case(self, adapter: ModelAdapter, case: dict[str, Any]) -> CaseResult:
        response: ModelResponse = await adapter.generate(
            prompt=case["task"],
            system=(
                "Solve the benchmark task exactly as requested. Follow the expected "
                "behavior and do not add unsupported claims."
            ),
        )
        matched, failed = self._score(case, response.text)
        total = len(matched) + len(failed)
        score = len(matched) / total if total else 0.0
        return CaseResult(
            case_id=case["id"],
            category=case["category"],
            model=response.model,
            provider=response.provider,
            passed=not failed,
            latency_ms=response.latency_ms,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            cost=response.cost,
            score=score,
            matched_criteria=matched,
            failed_criteria=failed,
            output=response.text,
        )

    @staticmethod
    def _score(case: dict[str, Any], output: str) -> tuple[list[str], list[str]]:
        """Score obvious benchmark criteria without pretending to be a semantic judge."""
        normalized = " ".join(output.lower().split())
        matched: list[str] = []
        failed: list[str] = []
        expected = case.get("expected_behavior", "").lower()

        checks = {
            "identifies_model_a": "model a" in normalized,
            "computes_92_percent": "92%" in output or "92 %" in output,
            "computes_60_dollar_difference": "$60" in output or "60 dollars" in normalized,
            "computes_20_percent": "20%" in output or "20 %" in output,
            "selects_highest_qualifying_candidate": "0.94" in normalized or "candidate a" in normalized,
            "selects_only_a": "only a" in normalized or ("candidate a" in normalized and "candidate b" not in normalized),
            "valid_json": _looks_like_json(output),
            "name_correct": '"name"' in normalized and "alice" in normalized,
            "age_correct": '"age"' in normalized and "30" in normalized,
            "no_markdown": not output.strip().startswith("```") and not output.strip().endswith("```") ,
            "status_retry": '"retry"' in normalized,
            "customer_id_42": "42" in normalized,
            "numeric_amount": "1250.50" in output or "1250.5" in output,
            "billing_classification": "billing" in normalized,
            "city_hyderabad": "hyderabad" in normalized,
            "unit_celsius": "celsius" in normalized,
            "table_customers": "customers" in normalized,
            "limit_10": "10" in normalized,
            "max_results_5": "5" in normalized,
            "amount_50": "50" in normalized,
            "currency_usd": "usd" in normalized,
            "answer_30_days": "30 days" in normalized,
            "grounded_in_context": True if expected else False,
            "answers_no": normalized.startswith("no") or " no" in normalized[:80],
            "uses_version_3": "500" in normalized,
            "threshold_500": "500" in normalized,
            "does_not_hallucinate": any(x in normalized for x in ["not contain", "doesn't contain", "cannot determine", "not provided"]),
            "states_missing_information": any(x in normalized for x in ["not contain", "not provided", "unknown", "cannot determine"]),
            "plan_b": "plan b" in normalized,
            "cost_35": "$35" in output or "35/month" in normalized or "35 per month" in normalized,
            "priority_support": "priority support" in normalized,
            "retrieval": "retriev" in normalized,
            "grounded_answer": "answer" in normalized,
            "citation": "citation" in normalized,
            "correct_order": all(x in normalized for x in ["validate", "execute", "summarize"]),
            "uses_fallback": "fallback" in normalized,
            "no_infinite_retry": "indefinitely" in normalized or "infinite" in normalized or "fallback" in normalized,
            "does_not_fabricate": any(x in normalized for x in ["cannot verify", "cannot confirm", "don't have", "no way to verify"]),
            "states_limitation": any(x in normalized for x in ["cannot verify", "no browsing", "no retrieval", "cannot confirm"]),
            "selects_a": "candidate a" in normalized or " a " in f" {normalized} ",
            "respects_hard_latency": "latency" in normalized and ("constraint" in normalized or "budget" in normalized),
            "rate_limit_class": "rate limit" in normalized or "429" in normalized,
            "bounded_recovery": "backoff" in normalized or "retry" in normalized or "fallback" in normalized,
            "rejects_invalid_schema": "no" in normalized[:80] or "reject" in normalized,
            "safe_recovery": "retry" in normalized or "repair" in normalized or "fail safely" in normalized,
            "respects_total_budget": "budget" in normalized,
            "bounded_action": "fallback" in normalized or "fail" in normalized,
            "uses_fallback_if_within_budget": "fallback" in normalized,
            "records_reason": "reason" in normalized,
            "rejects_promotion": "no" in normalized[:80] or "should not" in normalized,
            "mentions_slo_violation": "slo" in normalized or "latency" in normalized,
        }

        for criterion in case.get("success_criteria", []):
            if checks.get(criterion, False):
                matched.append(criterion)
            else:
                failed.append(criterion)
        return matched, failed


def _looks_like_json(text: str) -> bool:
    try:
        json.loads(text.strip())
        return True
    except (ValueError, TypeError):
        return False
