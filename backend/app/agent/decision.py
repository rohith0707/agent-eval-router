"""Deterministic runtime decision firewall for agent actions.

The firewall is intentionally small: it enforces policy before execution and
returns an auditable decision. It is not an enterprise IAM system.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    action: str
    allowed: bool
    reason_code: str
    reason: str
    policy_version: str
    risk: str


POLICY_VERSION = "v1"


def decide(*, task: str, model: str, tool_required: bool, estimated_cost_usd: float,
           max_cost_usd: float, task_type: str) -> Decision:
    """Fail closed for clearly unsafe/over-budget actions.

    v1 policies are deterministic and auditable. Risky action keywords require
    human approval; over-budget model execution is rejected before inference.
    """
    text = task.lower()
    high_risk = any(k in text for k in (
        "delete", "transfer money", "wire money", "refund", "send payment",
        "disable account", "drop database", "rotate production secret",
    ))
    if high_risk:
        return Decision(
            action="ESCALATE", allowed=False, reason_code="HIGH_RISK_APPROVAL",
            reason="High-impact action requires human approval before execution.",
            policy_version=POLICY_VERSION, risk="high",
        )

    if estimated_cost_usd > max_cost_usd:
        return Decision(
            action="BLOCK", allowed=False, reason_code="BUDGET_EXCEEDED",
            reason=f"Estimated cost ${estimated_cost_usd:.4f} exceeds budget ${max_cost_usd:.4f}.",
            policy_version=POLICY_VERSION, risk="medium",
        )

    if tool_required and task_type not in {"tool_calling", "auto"}:
        return Decision(
            action="BLOCK", allowed=False, reason_code="TOOL_POLICY_MISMATCH",
            reason="Tool execution is not permitted for the classified task type.",
            policy_version=POLICY_VERSION, risk="medium",
        )

    return Decision(
        action="ALLOW", allowed=True, reason_code="POLICY_PASS",
        reason=f"Policy v{POLICY_VERSION} permits {model} for this action.",
        policy_version=POLICY_VERSION, risk="low",
    )
