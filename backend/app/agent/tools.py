"""Bounded external tool execution with explicit failure classes and SSRF-safe policy."""
from __future__ import annotations

import ipaddress
import os
from time import perf_counter
from urllib.parse import urlparse

import httpx


class ToolExecutionError(RuntimeError):
    def __init__(self, failure_class: str, message: str) -> None:
        super().__init__(message)
        self.failure_class = failure_class


def _validate_tool_url(url: str) -> None:
    """Allow only explicitly approved HTTPS hosts; reject localhost/private targets."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ToolExecutionError("POLICY", "Tool URL must use HTTPS")
    if parsed.username or parsed.password:
        raise ToolExecutionError("POLICY", "Tool URL must not contain embedded credentials")
    host = parsed.hostname.lower().rstrip(".")
    if host in {"localhost", "localhost.localdomain"}:
        raise ToolExecutionError("POLICY", "Localhost tool targets are blocked")
    try:
        address = ipaddress.ip_address(host)
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ToolExecutionError("POLICY", "Private or local IP tool targets are blocked")
    except ValueError:
        # DNS names are allowed; production deployments should still provide an allowlist.
        pass

    allowlist = {h.strip().lower().rstrip(".") for h in os.getenv("AGENT_TOOL_ALLOWED_HOSTS", "").split(",") if h.strip()}
    if allowlist and host not in allowlist:
        raise ToolExecutionError("POLICY", "Tool host is not in AGENT_TOOL_ALLOWED_HOSTS")


async def execute_http_tool(task: str) -> dict:
    """Call a configured read-only HTTP endpoint with strict bounds."""
    url = os.getenv("AGENT_TOOL_URL", "https://httpbin.org/anything")
    _validate_tool_url(url)

    payload = {"task": task[:2000], "tool": "bounded_http", "untrusted": True}
    started = perf_counter()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0), follow_redirects=False) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 429:
                raise ToolExecutionError("RATE_LIMIT", "Tool rate limit")
            if 500 <= response.status_code < 600:
                raise ToolExecutionError("SERVER", f"Tool server returned {response.status_code}")
            response.raise_for_status()
            body = response.json()
    except ToolExecutionError:
        raise
    except httpx.TimeoutException as exc:
        raise ToolExecutionError("TIMEOUT", "Tool request timed out") from exc
    except httpx.HTTPStatusError as exc:
        raise ToolExecutionError("HTTP", f"Tool returned HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise ToolExecutionError("NETWORK", "Tool network failure") from exc
    except ValueError as exc:
        raise ToolExecutionError("VALIDATION", "Tool returned invalid JSON") from exc

    return {
        "tool": "bounded_http",
        "success": True,
        "latency_ms": int((perf_counter() - started) * 1000),
        "result": body,
        "trust": "UNTRUSTED_TOOL_OUTPUT",
    }
