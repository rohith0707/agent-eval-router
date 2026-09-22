"""Deterministic, fail-closed authorization for agent actions.

This is a runtime policy enforcement point, not an identity provider. Identity
and delegation evidence must arrive from a trusted caller; entitlements remain
server-side and are never accepted from the agent request.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


DEFAULT_POLICY_ID = "urn:agent-eval-router:agent-authorization"
DEFAULT_POLICY_VERSION = "v1"


@dataclass(frozen=True)
class AuthorizationDecision:
    action: str
    allowed: bool
    reason_code: str
    reason: str
    policy_id: str
    policy_version: str
    actor_id: str
    principal_id: str
    tool: str
    tool_action: str
    resource: str
    issued_at: str
    expires_at: str
    ttl_seconds: int
    parameters: dict[str, Any]


def _parse_time(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("expires_at must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError("expires_at must include a timezone")
    return parsed.astimezone(timezone.utc)


def _server_policy() -> dict[str, Any]:
    raw = os.getenv("AGENT_AUTHORIZATION_POLICY_JSON")
    if raw:
        try:
            policy = json.loads(raw)
            if not isinstance(policy, dict):
                raise ValueError
            return policy
        except (json.JSONDecodeError, ValueError):
            # Invalid security policy is safer as an empty policy than as a
            # permissive fallback.
            return {"allowed_tools": [], "allowed_actions": {}}
    return {
        "policy_id": DEFAULT_POLICY_ID,
        "policy_version": DEFAULT_POLICY_VERSION,
        "max_ttl_seconds": 900,
        "allowed_tools": ["bounded_http", "model.generate"],
        "allowed_actions": {"bounded_http": ["execute"], "model.generate": ["generate"]},
        "parameter_limits": {"bounded_http": {"max_task_length": 2000}},
    }


def authorize(
    *,
    actor_id: str,
    principal_id: str,
    tool: str,
    tool_action: str,
    resource: str = "",
    parameters: dict[str, Any] | None = None,
    expires_at: str,
    required_scope: str | None = None,
    now: datetime | None = None,
) -> AuthorizationDecision:
    """Evaluate a single action against trusted server-side entitlements."""
    policy = _server_policy()
    policy_id = str(policy.get("policy_id") or DEFAULT_POLICY_ID)
    policy_version = str(policy.get("policy_version") or DEFAULT_POLICY_VERSION)
    evaluated_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    parameters = dict(parameters or {})
    normalized_resource = resource or ""

    try:
        expiry = _parse_time(expires_at)
    except ValueError as exc:
        return _deny(
            "INVALID_EXPIRY", str(exc), policy_id, policy_version,
            actor_id, principal_id, tool, tool_action, normalized_resource,
            evaluated_at, expires_at, parameters,
        )

    ttl = int((expiry - evaluated_at).total_seconds())
    if ttl <= 0:
        return _deny(
            "AUTHORIZATION_EXPIRED", "Authorization has expired.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    max_ttl = int(policy.get("max_ttl_seconds", 900))
    if ttl > max_ttl:
        return _deny(
            "TTL_EXCEEDED", f"Authorization TTL exceeds policy maximum of {max_ttl}s.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    if not actor_id.strip() or not principal_id.strip():
        return _deny(
            "IDENTITY_REQUIRED", "Actor and principal identities are required.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    allowed_tools = set(policy.get("allowed_tools") or [])
    if tool not in allowed_tools:
        return _deny(
            "TOOL_NOT_AUTHORIZED", f"Tool '{tool}' is not authorized for this policy.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    allowed_actions = set((policy.get("allowed_actions") or {}).get(tool) or [])
    if tool_action not in allowed_actions:
        return _deny(
            "ACTION_NOT_AUTHORIZED", f"Action '{tool_action}' is not authorized for tool '{tool}'.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    if required_scope and required_scope not in set(policy.get("required_scopes", {}).get(tool, [])):
        return _deny(
            "SCOPE_NOT_AUTHORIZED", f"Required scope '{required_scope}' is not granted.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    limits = (policy.get("parameter_limits") or {}).get(tool, {})
    max_task_length = limits.get("max_task_length")
    task = parameters.get("task")
    if max_task_length is not None and isinstance(task, str) and len(task) > int(max_task_length):
        return _deny(
            "PARAMETER_CONSTRAINT", "Task parameter exceeds the authorized length limit.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    allowed_resources = limits.get("allowed_resources")
    if allowed_resources and normalized_resource not in set(allowed_resources):
        return _deny(
            "RESOURCE_NOT_AUTHORIZED", f"Resource '{normalized_resource}' is not authorized.",
            policy_id, policy_version, actor_id, principal_id, tool, tool_action,
            normalized_resource, evaluated_at, expires_at, parameters,
        )

    return AuthorizationDecision(
        action="ALLOW",
        allowed=True,
        reason_code="AUTHORIZATION_PASS",
        reason="Actor, delegated principal, tool, action, parameters, resource and TTL satisfy policy.",
        policy_id=policy_id,
        policy_version=policy_version,
        actor_id=actor_id,
        principal_id=principal_id,
        tool=tool,
        tool_action=tool_action,
        resource=normalized_resource,
        issued_at=evaluated_at.isoformat(),
        expires_at=expiry.isoformat(),
        ttl_seconds=ttl,
        parameters=parameters,
    )


def _deny(code: str, reason: str, policy_id: str, policy_version: str,
          actor_id: str, principal_id: str, tool: str, tool_action: str,
          resource: str, issued_at: datetime, expires_at: str,
          parameters: dict[str, Any]) -> AuthorizationDecision:
    return AuthorizationDecision(
        action="BLOCK",
        allowed=False,
        reason_code=code,
        reason=reason,
        policy_id=policy_id,
        policy_version=policy_version,
        actor_id=actor_id,
        principal_id=principal_id,
        tool=tool,
        tool_action=tool_action,
        resource=resource,
        issued_at=issued_at.isoformat(),
        expires_at=expires_at,
        ttl_seconds=0,
        parameters=parameters,
    )
