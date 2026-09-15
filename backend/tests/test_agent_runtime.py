from app.agent.decision import decide
from app.agent.graph import _should_stop
from app.evaluation.quality import score_output


def test_high_risk_action_requires_approval():
    result = decide(task="refund customer $2400", model="gpt-5-mini", tool_required=True,
                    estimated_cost_usd=0.001, max_cost_usd=0.01, task_type="tool_calling")
    assert result.action == "ESCALATE"
    assert result.allowed is False
    assert result.reason_code == "HIGH_RISK_APPROVAL"


def test_budget_policy_blocks_before_execution():
    result = decide(task="summarize this document", model="expensive-model", tool_required=False,
                    estimated_cost_usd=0.02, max_cost_usd=0.01, task_type="rag")
    assert result.action == "BLOCK"
    assert result.allowed is False
    assert result.reason_code == "BUDGET_EXCEEDED"


def test_evaluator_uses_output_not_constant_quality():
    empty_quality, empty_checks = score_output("solve this", "")
    good_quality, good_checks = score_output("solve this", "A structured answer with enough detail to evaluate the result.")
    assert empty_quality == 0.0
    assert "empty_output" in empty_checks
    assert good_quality > empty_quality
    assert "non_empty" in good_checks


def test_hard_stop_on_cost():
    stop, reason = _should_stop({"total_cost_usd": 0.11, "max_cost_usd": 0.10, "iteration": 1, "max_iterations": 3, "max_failures": 2, "attempts": []}, __import__("time").monotonic())
    assert stop is True
    assert reason == "max_cost_exceeded"


def test_hard_stop_on_iterations():
    stop, reason = _should_stop({"total_cost_usd": 0, "max_cost_usd": 1, "iteration": 3, "max_iterations": 3, "max_failures": 2, "attempts": []}, __import__("time").monotonic())
    assert stop is True
    assert reason == "max_iterations_exceeded"
