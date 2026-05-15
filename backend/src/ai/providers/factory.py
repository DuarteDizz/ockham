"""LLM model factories used by ranking and Strands agent layers."""

from __future__ import annotations

from inspect import signature
from typing import Any

from loguru import logger
from langchain_ollama import ChatOllama

from src.ai.runtime_config import EffectiveLlmConfig, llm_runtime_config_store
from src.config.settings import settings


def _ollama_openai_compatible_base_url(base_url: str | None) -> str:
    base_url = (base_url or "http://127.0.0.1:11434").rstrip("/")
    if base_url.endswith("/v1"):
        return base_url
    return f"{base_url}/v1"


def _ollama_native_base_url(base_url: str | None) -> str:
    """Return the native Ollama host URL, never the OpenAI-compatible /v1 URL."""
    base_url = (base_url or "http://127.0.0.1:11434").rstrip("/")
    if base_url.endswith("/v1"):
        return base_url[: -len("/v1")]
    return base_url


def _chat_ollama_thinking_kwargs(*, use_thinking: bool | None) -> dict[str, Any]:
    """Build thinking/reasoning kwargs supported by the installed ChatOllama.

    LangChain's Ollama wrapper has evolved over time. Newer versions expose a
    `reasoning` parameter, while some versions experimented with `think`. Keep
    this helper defensive so the runtime does not fail when a user has an older
    compatible dependency installed.
    """
    if use_thinking is None:
        return {}

    try:
        parameters = signature(ChatOllama).parameters
    except (TypeError, ValueError):  # pragma: no cover - defensive for pydantic wrappers
        parameters = {}

    if "reasoning" in parameters:
        return {"reasoning": use_thinking}
    if "think" in parameters:
        return {"think": use_thinking}
    return {}


def _ollama_strands_additional_args(*, use_thinking: bool | None) -> dict[str, Any]:
    """Build native Ollama request args for Strands' OllamaModel."""
    args: dict[str, Any] = {"format": "json"}
    if use_thinking is not None:
        args["think"] = use_thinking
    return args


def build_langchain_chat_model(
    config: EffectiveLlmConfig | None = None,
    *,
    use_thinking: bool | None = None,
):
    """Build the LangChain chat model for the active runtime provider.

    `use_thinking` is currently applied only when the selected provider supports
    a native thinking/reasoning control. It is intentionally optional because the
    ranking flow may want provider defaults, while preprocessing should disable
    thinking explicitly through the Strands model factory.
    """
    config = config or llm_runtime_config_store.get_effective_config()

    if config.provider == "ollama":
        return ChatOllama(
            base_url=config.base_url,
            model=config.model,
            temperature=config.temperature,
            timeout=config.timeout_seconds,
            format="json",
            **_chat_ollama_thinking_kwargs(use_thinking=use_thinking),
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


def build_strands_model(
    config: EffectiveLlmConfig | None = None,
    *,
    use_thinking: bool | None = False,
):
    """Build the Strands model for preprocessing agents.

    Preprocessing agents need compact, contract-following JSON responses. For
    Ollama, use Strands' native OllamaModel so the backend can pass Ollama's
    native `think=false` request parameter instead of relying on prompt tags or
    the OpenAI-compatible endpoint, which does not expose that control.
    """
    config = config or llm_runtime_config_store.get_effective_config()

    if config.provider == "ollama":
        try:
            from strands.models.ollama import OllamaModel
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "The preprocessing agent flow requires Strands' Ollama model provider. "
                "Install backend dependencies again, including strands-agents with Ollama support."
            ) from exc

        logger.info(
            "Building Strands Ollama model. provider={} model={} base_url={} temperature={} max_tokens={} think={}",
            config.provider,
            config.model,
            config.base_url,
            config.temperature,
            config.max_tokens,
            use_thinking,
        )

        return OllamaModel(
            host=_ollama_native_base_url(config.base_url),
            model_id=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            keep_alive=settings.ollama_keep_alive,
            additional_args=_ollama_strands_additional_args(use_thinking=use_thinking),
        )

    try:
        from strands.models.openai import OpenAIModel
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "The preprocessing agent flow requires strands-agents. Install backend dependencies again."
        ) from exc

    if not config.has_api_key:
        raise ValueError(f"Provider '{config.provider}' requires an API key.")

    client_args = {"api_key": config.api_key.get_secret_value()}
    if config.base_url:
        client_args["base_url"] = config.base_url

    logger.info(
        "Building Strands OpenAI-compatible model. provider={} model={} base_url={} temperature={} max_tokens={} has_api_key={}",
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
