from __future__ import annotations

import os

from .adapters.base import ModelAdapter
from .adapters.http_anthropic import AnthropicAdapter
from .adapters.http_openai import OpenAIAdapter
from .adapters.ollama import OllamaAdapter


def build_registry() -> dict[str, ModelAdapter]:
    registry: dict[str, ModelAdapter] = {}
    if os.getenv("OPENAI_API_KEY"):
        registry["openai"] = OpenAIAdapter(os.getenv("OPENAI_MODEL", "gpt-5-mini"))
    if os.getenv("ANTHROPIC_API_KEY"):
        registry["anthropic"] = AnthropicAdapter(os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5"))
    if os.getenv("OLLAMA_ENABLED", "false").lower() == "true":
        registry["ollama"] = OllamaAdapter(os.getenv("OLLAMA_MODEL", "llama3.2"))
    return registry
