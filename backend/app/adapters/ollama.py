from __future__ import annotations

import os
from time import perf_counter

import httpx

from .base import ModelAdapter, ModelResponse


class OllamaAdapter(ModelAdapter):
    provider = "ollama"

    def __init__(self, model: str = "llama3.2") -> None:
        self.name = model
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    async def generate(self, prompt: str, system: str | None = None, max_tokens: int = 512) -> ModelResponse:
        started = perf_counter()
        body = {"model": self.name, "prompt": prompt, "stream": False, "options": {"num_predict": max_tokens}}
        if system:
            body["system"] = system
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{self.base_url.rstrip('/')}/api/generate", json=body)
            response.raise_for_status()
        data = response.json()
        input_tokens = int(data.get("prompt_eval_count", 0))
        output_tokens = int(data.get("eval_count", 0))
        return ModelResponse(self.name, data.get("response", ""), int((perf_counter() - started) * 1000), input_tokens, output_tokens, 0.0, self.provider, data)
