"""LLM model factories used by ranking and Strands agent layers."""

from __future__ import annotations

from loguru import logger
from langchain_ollama import ChatOllama

from src.ai.runtime_config import EffectiveLlmConfig, llm_runtime_config_store


def _ollama_openai_compatible_base_url(base_url: str | None) -> str:
    base_url = (base_url or "http://127.0.0.1:11434").rstrip("/")
    if base_url.endswith("/v1"):
        return base_url
    return f"{base_url}/v1"


def build_langchain_chat_model(config: EffectiveLlmConfig | None = None):
    """Build the LangChain chat model for the active runtime provider."""
    config = config or llm_runtime_config_store.get_effective_config()

    if config.provider == "ollama":
        return ChatOllama(
            base_url=config.base_url,
            model=config.model,
            temperature=config.temperature,
            timeout=config.timeout_seconds,
            format="json",
        )

    if not config.has_api_key:
        raise ValueError(f"Provider '{config.provider}' requires an API key.")

    try:
        from langchain_openai import ChatOpenAI
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "The selected provider requires langchain-openai. Install backend dependencies again."
        ) from exc

    model_kwargs = {"response_format": {"type": "json_object"}}
    api_key = config.api_key.get_secret_value() if config.api_key else None

    return ChatOpenAI(
        api_key=api_key,
        base_url=config.base_url,
        model=config.model,
        temperature=config.temperature,
        timeout=config.timeout_seconds,
        max_tokens=config.max_tokens,
        model_kwargs=model_kwargs,
    )


def build_strands_model(config: EffectiveLlmConfig | None = None):
    """Build the Strands model for preprocessing agents.

    Ollama is used through its OpenAI-compatible endpoint so the Strands graph can
    keep the same OpenAIModel abstraction while still defaulting to local models.
    """
    config = config or llm_runtime_config_store.get_effective_config()

    try:
        from strands.models.openai import OpenAIModel
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "The preprocessing agent flow requires strands-agents. Install backend dependencies again."
        ) from exc

    if config.provider == "ollama":
        client_args = {
            "api_key": "ollama",
            "base_url": _ollama_openai_compatible_base_url(config.base_url),
        }
    else:
        if not config.has_api_key:
            raise ValueError(f"Provider '{config.provider}' requires an API key.")
        client_args = {"api_key": config.api_key.get_secret_value()}
        if config.base_url:
            client_args["base_url"] = config.base_url

    logger.info(
        "Building Strands model. provider={} model={} base_url={} temperature={} max_tokens={} has_api_key={}",
        config.provider,
        config.model,
        config.base_url,
        config.temperature,
        config.max_tokens,
        config.has_api_key,
    )

    return OpenAIModel(
        client_args=client_args,
        model_id=config.model,
        params={
            "max_tokens": config.max_tokens,
            "temperature": config.temperature,
        },
    )
