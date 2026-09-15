"""Bounded external tool execution with explicit failure classes."""
from __future__ import annotations

import os
from time import perf_counter

import httpx


class ToolExecutionError(RuntimeError):
    def __init__(self, failure_class: str, message: str) -> None:
        super().__init__(message)
        self.failure_class = failure_class


async def execute_http_tool(task: str) -> dict:
    """Call a configured read-only HTTP endpoint with strict bounds.

    The default endpoint is httpbin's response endpoint for local/demo use.
    Production deployments should set AGENT_TOOL_URL to an approved endpoint.
    """
    url = os.getenv("AGENT_TOOL_URL", "https://httpbin.org/anything")
    if not (url.startswith("https://") or url.startswith("http://localhost")):
        raise ToolExecutionError("POLICY", "Tool URL must use HTTPS or localhost HTTP")

    payload = {"task": task[:2000], "tool": "bounded_http"}
    started = perf_counter()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
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
    }
