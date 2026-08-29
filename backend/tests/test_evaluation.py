from app.evaluation import evaluate_text


def test_required_terms_pass():
    score = evaluate_text("Use a calculator tool to compute the result.", required_terms=["calculator"])
    assert score.passed
    assert score.relevance == 1.0


def test_empty_output_fails():
    score = evaluate_text("")
    assert score.failure_type == "EMPTY_OUTPUT"
    assert not score.passed


def test_explanatory_answer_can_match_reference():
    score = evaluate_text("The answer is 42 because 17 + 25 = 42.", expected="42", required_terms=["42"])
    assert score.passed
    assert score.correctness == 1.0


# Intentionally bad outputs: these are regression cases proving that keyword
# presence alone is not sufficient for acceptance.
def test_bad_output_wrong_number_fails():
    score = evaluate_text("The answer is 41.", expected="42", required_terms=["42"])
    assert not score.passed
    assert score.failure_type == "EXPECTED_MISMATCH"


def test_bad_output_negated_reference_fails():
    score = evaluate_text("The answer is not 42.", expected="42", required_terms=["42"])
    assert not score.passed
    assert score.failure_type == "CONTRADICTS_REFERENCE"


def test_bad_output_missing_required_term_fails():
    score = evaluate_text("Use a spreadsheet to compute the result.", required_terms=["calculator"])
    assert not score.passed
    assert score.failure_type == "REQUIRED_TERM_MISSING"


def test_bad_output_partial_reference_fails():
    score = evaluate_text("The answer is 43.", expected="42")
    assert not score.passed
    assert score.failure_type == "EXPECTED_MISMATCH"


def test_bad_output_json_contract_fails():
    score = evaluate_text('{"name": "Alice"', expected='{"name": "Alice"}')
    assert not score.passed
    assert score.failure_type == "INVALID_STRUCTURED_OUTPUT"


def test_failure_precedence_invalid_json_beats_reference_match():
    """Malformed structured output must fail even when text matches the reference."""
    score = evaluate_text('{"name": "Alice"', expected='{"name": "Alice"}')
    assert score.correctness == 1.0
    assert score.structured_output_valid is False
    assert score.failure_type == "INVALID_STRUCTURED_OUTPUT"
    assert not score.passed


def test_failure_precedence_mismatch_beats_missing_required_term():
    """Reference mismatch is the primary category when both checks fail."""
    score = evaluate_text("The answer is 43.", expected="42", required_terms=["42"])
    assert score.correctness == 0.0
    assert score.relevance == 0.0
    assert score.failure_type == "EXPECTED_MISMATCH"
    assert not score.passed
