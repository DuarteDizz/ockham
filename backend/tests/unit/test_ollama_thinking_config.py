from __future__ import annotations

import sys
import types

from src.ai.providers import factory
from src.ai.runtime_config import EffectiveLlmConfig


class FakeOllamaModel:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


def _ollama_config() -> EffectiveLlmConfig:
    return EffectiveLlmConfig(
        provider="ollama",
        model="qwen3.5:9b",
        base_url="http://127.0.0.1:11434/v1",
        api_key=None,
        temperature=0.0,
        max_tokens=1000,
        timeout_seconds=120,
        source="runtime",
    )


def test_ollama_native_base_url_strips_openai_compatible_suffix():
    assert factory._ollama_native_base_url("http://127.0.0.1:11434/v1") == "http://127.0.0.1:11434"


def test_strands_ollama_args_disable_thinking_for_preprocessing():
    args = factory._ollama_strands_additional_args(use_thinking=False)

    assert args["think"] is False
    assert args["format"] == "json"


def test_build_strands_model_uses_native_ollama_provider_with_think_false(monkeypatch):
    fake_ollama_module = types.ModuleType("strands.models.ollama")
    fake_ollama_module.OllamaModel = FakeOllamaModel
    monkeypatch.setitem(sys.modules, "strands.models.ollama", fake_ollama_module)

    model = factory.build_strands_model(_ollama_config(), use_thinking=False)

    assert isinstance(model, FakeOllamaModel)
    assert model.kwargs["host"] == "http://127.0.0.1:11434"
    assert model.kwargs["model_id"] == "qwen3.5:9b"
    assert model.kwargs["additional_args"]["think"] is False
    assert model.kwargs["additional_args"]["format"] == "json"
