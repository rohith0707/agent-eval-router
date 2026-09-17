import os

import pytest

from app.agent.tools import ToolExecutionError, _validate_tool_url


def test_tool_requires_https(monkeypatch):
    with pytest.raises(ToolExecutionError, match="HTTPS"):
        _validate_tool_url("http://example.com/api")


def test_localhost_is_blocked():
    with pytest.raises(ToolExecutionError, match="Localhost"):
        _validate_tool_url("http://localhost:8080/internal")


def test_private_ip_is_blocked():
    with pytest.raises(ToolExecutionError, match="Private"):
        _validate_tool_url("https://127.0.0.1/internal")


def test_credentials_in_url_are_blocked():
    with pytest.raises(ToolExecutionError, match="credentials"):
        _validate_tool_url("https://user:pass@example.com/api")


def test_allowlist_can_restrict_hosts(monkeypatch):
    monkeypatch.setenv("AGENT_TOOL_ALLOWED_HOSTS", "approved.example.com")
    _validate_tool_url("https://approved.example.com/api")
    with pytest.raises(ToolExecutionError, match="allowlist"):
        _validate_tool_url("https://other.example.com/api")
