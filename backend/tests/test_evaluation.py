from app.evaluation import evaluate_text


def test_required_terms_pass():
    score = evaluate_text("Use a calculator tool to compute the result.", required_terms=["calculator"])
    assert score.passed


def test_empty_output_fails():
    score = evaluate_text("")
    assert score.failure_type == "EMPTY_OUTPUT"
    assert not score.passed
