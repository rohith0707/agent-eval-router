from app.router import route


def test_selects_highest_quality_eligible_model():
    decision = route(quality_threshold=0.90, latency_budget_ms=2500, cost_budget=0.03)
    assert decision.selected.model == "Claude Sonnet"
    assert decision.passed is True


def test_uses_fallback_when_constraints_are_too_strict():
    decision = route(quality_threshold=0.99, latency_budget_ms=1000, cost_budget=0.001)
    assert decision.passed is False
    assert decision.selected.model == "Claude Sonnet"
