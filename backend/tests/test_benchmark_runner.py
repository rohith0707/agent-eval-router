import json

import pytest

from app.adapters.base import ModelAdapter, ModelResponse
from app.evaluation.runner import BenchmarkRunner
from app.evaluation.report import summarize


class FakeAdapter(ModelAdapter):
    name = "fake-model"
    provider = "test"

    async def generate(self, prompt: str, system: str | None = None, max_tokens: int = 512) -> ModelResponse:
        if "100 requests" in prompt:
            text = "Model A has the higher empirical success rate: 92%."
        elif "quality threshold" in prompt:
            text = "Select the 0.94 candidate."
        elif "structured" in prompt.lower() and "Alice" in prompt:
            text = '{"name":"Alice","age":30}'
        else:
            text = "No, the provided context does not contain enough information."
        return ModelResponse(
            model=self.name,
            provider=self.provider,
            text=text,
            latency_ms=100,
            input_tokens=20,
            output_tokens=10,
            cost=0.001,
            raw={},
        )


@pytest.mark.asyncio
async def test_runner_scores_cases(tmp_path):
    dataset = tmp_path / "cases.jsonl"
    dataset.write_text(
        "\n".join(
            [
                json.dumps({
                    "id": "r1",
                    "category": "reasoning",
                    "task": "A service has 100 requests. Model A succeeds on 92 and Model B succeeds on 88. Which has the higher empirical success rate?",
                    "expected_behavior": "92%",
                    "success_criteria": ["identifies_model_a", "computes_92_percent"],
                }),
                json.dumps({
                    "id": "s1",
                    "category": "structured_output",
                    "task": "Return a structured JSON object with fields name and age for Alice, age 30.",
                    "expected_behavior": "valid JSON",
                    "success_criteria": ["valid_json", "name_correct", "age_correct"],
                }),
            ]
        ),
        encoding="utf-8",
    )

    runner = BenchmarkRunner(dataset)
    results = [await runner.run_case(FakeAdapter(), case) for case in runner.load_cases()]
    report = summarize(results)

    assert report["cases"] == 2
    assert report["pass_rate"] == 1.0
    assert report["p95_latency_ms"] == 100.0
    assert report["total_cost"] == pytest.approx(0.002)
