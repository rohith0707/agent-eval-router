"""Small deterministic evaluator used by the live agent path.

This is deliberately transparent rather than pretending to be an LLM judge.
It measures observable output properties and should be replaced/extended with
reference-based or judge-based evaluators for domain benchmarks.
"""
from __future__ import annotations


def score_output(task: str, output: str) -> tuple[float, list[str]]:
    if not output or not output.strip():
        return 0.0, ["empty_output"]

    checks: list[str] = ["non_empty"]
    score = 0.40
    if len(output.strip()) >= 40:
        score += 0.20
        checks.append("sufficient_length")
    if any(marker in output for marker in (".", ":", "-", "\n")):
        score += 0.10
        checks.append("structured_text")
    if len(output.strip()) <= 12000:
        score += 0.10
        checks.append("bounded_output")
    if task.strip().lower() in output.strip().lower():
        score += 0.05
        checks.append("task_reference")
    if any(word in output.lower() for word in ("cannot", "error", "failed")):
        score -= 0.05
        checks.append("failure_language")

    return max(0.0, min(1.0, round(score, 4))), checks
