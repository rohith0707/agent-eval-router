from __future__ import annotations

import os
from time import perf_counter

import httpx

from .base import ModelAdapter, ModelResponse


class OpenAIAdapter(ModelAdapter):
    provider = "openai"

    def __init__(self, model: str = "gpt-5-mini") -> None:
        self.name = model
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.input_price = float(os.getenv("OPENAI_INPUT_PRICE_PER_1M", "0"))
        self.output_price = float(os.getenv("OPENAI_OUTPUT_PRICE_PER_1M", "0"))

    async def generate(self, prompt: str, system: str | None = None, max_tokens: int = 512) -> ModelResponse:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        started = perf_counter()
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": self.name, "messages": messages, "max_tokens": max_tokens},
            )
            response.raise_for_status()
        data = response.json()
        usage = data.get("usage", {})
        input_tokens = int(usage.get("prompt_tokens", 0))
        output_tokens = int(usage.get("completion_tokens", 0))
        cost = input_tokens / 1_000_000 * self.input_price + output_tokens / 1_000_000 * self.output_price
        return ModelResponse(self.name, data["choices"][0]["message"]["content"], int((perf_counter() - started) * 1000), input_tokens, output_tokens, cost, self.provider, data)
