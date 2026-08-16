from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ModelResponse:
    model: str
    text: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    cost: float
    provider: str
    raw: dict[str, Any]


class ModelAdapter(ABC):
    name: str
    provider: str

    @abstractmethod
    async def generate(self, prompt: str, system: str | None = None, max_tokens: int = 512) -> ModelResponse:
        raise NotImplementedError
