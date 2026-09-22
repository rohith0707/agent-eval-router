from datetime import datetime, timedelta, timezone

from app.agent.authorization import authorize


def _expiry(seconds=300):
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def test_authorized_tool_call_allows_with_identity_and_ttl():
    result = authorize(
        actor_id="agent:researcher",
        principal_id="user:123",
        tool="bounded_http",
        tool_action="execute",
        parameters={"task": "search docs"},
        expires_at=_expiry(),
    )
    assert result.action == "ALLOW"
    assert result.allowed is True
    assert result.actor_id == "agent:researcher"
    assert result.principal_id == "user:123"
    assert result.ttl_seconds > 0


def test_unauthorized_tool_is_blocked():
    result = authorize(
        actor_id="agent:researcher",
        principal_id="user:123",
        tool="delete_database",
        tool_action="execute",
        parameters={},
        expires_at=_expiry(),
    )
    assert result.action == "BLOCK"
    assert result.reason_code == "TOOL_NOT_AUTHORIZED"


def test_parameter_escalation_is_blocked():
    result = authorize(
        actor_id="agent:researcher",
        principal_id="user:123",
        tool="bounded_http",
        tool_action="execute",
        parameters={"task": "x" * 2001},
        expires_at=_expiry(),
    )
    assert result.action == "BLOCK"
    assert result.reason_code == "PARAMETER_CONSTRAINT"


def test_expired_authorization_is_blocked():
    result = authorize(
        actor_id="agent:researcher",
        principal_id="user:123",
        tool="bounded_http",
        tool_action="execute",
        parameters={"task": "search docs"},
        expires_at=_expiry(-1),
    )
    assert result.action == "BLOCK"
    assert result.reason_code == "AUTHORIZATION_EXPIRED"


def test_ttl_cannot_exceed_policy_maximum():
    result = authorize(
        actor_id="agent:researcher",
        principal_id="user:123",
        tool="bounded_http",
        tool_action="execute",
        parameters={"task": "search docs"},
        expires_at=_expiry(901),
    )
    assert result.action == "BLOCK"
    assert result.reason_code == "TTL_EXCEEDED"
