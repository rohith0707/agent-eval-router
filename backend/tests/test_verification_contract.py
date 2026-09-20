import pytest

from app.agent.verification import verify_candidate


@pytest.mark.asyncio
async def test_verification_requires_independent_provider(monkeypatch):
    class FakeRegistryAdapter:
        provider = "openai"
        name = "test-model"

    monkeypatch.setattr(
        "app.agent.verification.build_registry",
        lambda: {"openai": FakeRegistryAdapter()},
    )

    result = await verify_candidate(
        task="what is this product?",
        task_type="research",
        output="A product explanation.",
        worker_provider="openai",
        max_tokens=128,
    )

    assert result["passed"] is False
    assert result["provenance"] == "VERIFICATION_INCOMPLETE"
    assert "independent_verifier_unavailable" in result["checks"]


@pytest.mark.asyncio
async def test_verification_accepts_structured_independent_provider(monkeypatch):
    class FakeResponse:
        latency_ms = 12
        text = '{"passed": true, "quality": 0.91, "checks": ["relevance", "groundedness"], "reason": "Directly answers the task."}'

    class FakeAdapter:
        provider = "anthropic"
        name = "verifier-model"

        async def generate(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(
        "app.agent.verification.build_registry",
        lambda: {
            "openai": object(),
            "anthropic": FakeAdapter(),
        },
    )

    result = await verify_candidate(
        task="what is this product?",
        task_type="research",
        output="It is an execution layer for bounded autonomous AI work.",
        worker_provider="openai",
        max_tokens=128,
    )

    assert result["passed"] is True
    assert result["provenance"] == "LIVE_INDEPENDENT_VERIFIER"
    assert result["verifier_provider"] == "anthropic"
