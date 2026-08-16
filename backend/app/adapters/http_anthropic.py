from __future__ import annotations

import os
from time import perf_counter

import httpx

from .base import ModelAdapter, ModelResponse


class AnthropicAdapter(ModelAdapter):
    provider = "anthropic"

    def __init__(self, model: str = "claude-sonnet-4-5") -> None:
        self.name = model
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")
        self.input_price = float(os.getenv("ANTHROPIC_INPUT_PRICE_PER_1M", "0"))
        self.output_price = float(os.getenv("ANTHROPIC_OUTPUT_PRICE_PER_1M", "0"))

    async def generate(self, prompt: str, system: str | None = None, max_tokens: int = 512) -> ModelResponse:
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured")
        started = perf_counter()
        body = {"model": self.name, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
        if system:
            body["system"] = system
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json=body,
            )
            response.raise_for_status()
        data = response.json()
        usage = data.get("usage", {})
        input_tokens = int(usage.get("input_tokens", 0))
        output_tokens = int(usage.get("output_tokens", 0))
        cost = input_tokens / 1_000_000 * self.input_price + output_tokens / 1_000_000 * self.output_price
        text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
        return ModelResponse(self.name, text, int((perf_counter() - started) * 1000), input_tokens, output_tokens, cost, self.provider, data)
