"""Independent verification for the live agent loop.

A candidate result is never considered complete merely because it is non-empty.
A second, independently configured provider must evaluate the candidate for the
current runtime to emit a VERIFIED outcome.
"""

from __future__ import annotations

import json
from typing import Any

from ..provider_registry import build_registry


def _parse_json(text: str) -> dict[str, Any] | None:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


async def verify_candidate(
    *,
    task: str,
    task_type: str,
    output: str,
    worker_provider: str | None,
    max_tokens: int,
) -> dict[str, Any]:
    """Verify a candidate using a different configured provider.

    If a second provider is unavailable, return REVIEW rather than VERIFIED.
    """

    registry = build_registry()
    verifier_candidates = [
        (name, adapter)
        for name, adapter in registry.items()
        if name != worker_provider
    ]

    if not verifier_candidates:
        return {
            "passed": False,
            "quality": 0.0,
            "checks": ["independent_verifier_unavailable"],
            "reason": "No independently configured verifier provider is available.",
            "provenance": "VERIFICATION_INCOMPLETE",
        }

    verifier_provider, verifier = verifier_candidates[0]
    prompt = (
        "Evaluate a candidate result against the user's task. "
        "Do not reward confident prose. Do not assume an external action happened "
        "unless the candidate contains evidence of that action. "
        "Return ONLY JSON with keys: passed (boolean), quality (0..1), "
        "checks (array of short strings), reason (string).\n\n"
        f"Task type: {task_type}\n"
        f"Task: {task}\n"
        f"Candidate result:\n{output[:12000]}"
    )

    try:
        response = await verifier.generate(
            prompt,
            system=(
                "You are an independent verification worker. "
                "Your job is to reject unsupported completion claims."
            ),
            max_tokens=min(max_tokens, 384),
        )
    except Exception as exc:
        return {
            "passed": False,
            "quality": 0.0,
            "checks": ["verifier_execution_failed"],
            "reason": f"Independent verifier failed: {type(exc).__name__}.",
            "provenance": "VERIFICATION_INCOMPLETE",
            "verifier_provider": verifier_provider,
            "verifier_model": verifier.name,
        }

    parsed = _parse_json(response.text)
    if not parsed or not isinstance(parsed.get("passed"), bool):
        return {
            "passed": False,
            "quality": 0.0,
            "checks": ["verifier_response_invalid"],
            "reason": "Independent verifier did not return the required structured decision.",
            "provenance": "VERIFICATION_INCOMPLETE",
            "verifier_provider": verifier_provider,
            "verifier_model": verifier.name,
        }

    checks = parsed.get("checks")
    if not isinstance(checks, list):
        checks = []

    return {
        "passed": bool(parsed["passed"]),
        "quality": max(0.0, min(1.0, float(parsed.get("quality", 0.0)))),
        "checks": [str(check)[:120] for check in checks[:8]],
        "reason": str(parsed.get("reason", "Independent verifier completed."))[:500],
        "provenance": "LIVE_INDEPENDENT_VERIFIER",
        "verifier_provider": verifier_provider,
        "verifier_model": verifier.name,
        "latency_ms": response.latency_ms,
    }
