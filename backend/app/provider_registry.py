from __future__ import annotations

import os
from typing import Dict, Type

from .adapters.base import ModelAdapter
from .adapters.http_anthropic import AnthropicAdapter
from .adapters.http_openai import OpenAIAdapter
from .adapters.ollama import OllamaAdapter


PROVIDER_MAP: Dict[str, Type[ModelAdapter]] = {
    "openai": OpenAIAdapter,
    "anthropic": AnthropicAdapter,
    "ollama": OllamaAdapter,
}


def build_registry() -> Dict[str, ModelAdapter]:
    """Build a registry of configured model adapters from environment variables.

    Returns a dictionary mapping provider names to instantiated adapters.
    Logs which providers are registered and which are skipped due to missing configuration.
    """
    registry: Dict[str, ModelAdapter] = {}

    for provider_name, adapter_class in PROVIDER_MAP.items():
        if provider_name == "openai":
            if not os.getenv("OPENAI_API_KEY"):
                continue  # Skip if not configured
            adapter = adapter_class(
                model=os.getenv("OPENAI_MODEL", "gpt-5-mini")
            )
            registry[provider_name] = adapter
            print(f"[provider_registry] Registered {provider_name}: {adapter.name}")

        elif provider_name == "anthropic":
            if not os.getenv("ANTHROPIC_API_KEY"):
                continue
            adapter = adapter_class(
                model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
            )
            registry[provider_name] = adapter
            print(f"[provider_registry] Registered {provider_name}: {adapter.name}")

        elif provider_name == "ollama":
            if os.getenv("OLLAMA_ENABLED", "false").lower() != "true":
                continue
            adapter = adapter_class(
                model=os.getenv("OLLAMA_MODEL", "llama3.2")
            )
            registry[provider_name] = adapter
            print(f"[provider_registry] Registered {provider_name}: {adapter.name}")

    if not registry:
        print("[provider_registry] Warning: No model providers are configured.")

    return registry