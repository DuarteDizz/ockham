"""Runtime LLM configuration for Ockham.

The frontend may submit a custom provider/model/API key, but the backend never
returns the secret value. By default, Ockham uses local Ollama.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from threading import RLock
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from src.config import settings

LlmProvider = Literal["ollama", "openai", "openai_compatible"]


@dataclass(frozen=True)
class EffectiveLlmConfig:
    """Backend-only effective configuration used to instantiate LLM clients."""

    provider: LlmProvider
    model: str
    base_url: str | None
    api_key: SecretStr | None
    temperature: float
    max_tokens: int
    timeout_seconds: int
    source: Literal["settings", "runtime"]

    @property
    def has_api_key(self) -> bool:
        return bool(self.api_key and self.api_key.get_secret_value().strip())

    @property
    def provider_label(self) -> str:
        if self.provider == "ollama":
            return "Ollama"
        if self.provider == "openai":
            return "OpenAI"
        return "OpenAI compatible"


class LlmConfigResponse(BaseModel):
    """Public configuration response. Never expose api_key here."""

    provider: LlmProvider
    model: str
    base_url: str | None = None
    temperature: float
    max_tokens: int
    timeout_seconds: int
    source: Literal["settings", "runtime"]
    has_custom_api_key: bool
    default_provider: LlmProvider = "ollama"


class LlmConfigUpdateRequest(BaseModel):
    """Request used to update the backend-only runtime LLM configuration."""

    model_config = ConfigDict(str_strip_whitespace=True)

    provider: LlmProvider
    model: str = Field(min_length=1)
    base_url: str | None = None
    api_key: SecretStr | None = None
    clear_api_key: bool = False
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1000, ge=1, le=32000)
    timeout_seconds: int = Field(default=120, ge=1, le=600)

    @field_validator("base_url")
    @classmethod
    def normalize_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().rstrip("/")
        return value or None


class LlmRuntimeConfigStore:
    """Small in-memory store for runtime LLM configuration.

    This intentionally does not persist user-provided API keys to SQLite. In the
    current local product shape there is no user/account boundary or encryption
    layer, so memory-only storage is safer and easier to reason about.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._runtime_config: EffectiveLlmConfig | None = None

    def get_effective_config(self) -> EffectiveLlmConfig:
        with self._lock:
            if self._runtime_config is not None:
                return self._runtime_config
            return build_settings_config()

    def update(self, request: LlmConfigUpdateRequest) -> EffectiveLlmConfig:
        with self._lock:
            existing = self._runtime_config or build_settings_config()

            api_key = request.api_key
            if request.clear_api_key:
                api_key = None
            elif api_key is None and request.provider == existing.provider:
                api_key = existing.api_key

            base_url = resolve_base_url_for_provider(request.provider, request.base_url)

            self._runtime_config = EffectiveLlmConfig(
                provider=request.provider,
                model=request.model,
                base_url=base_url,
                api_key=api_key,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                timeout_seconds=request.timeout_seconds,
                source="runtime",
            )
            return self._runtime_config

    def reset(self) -> EffectiveLlmConfig:
        with self._lock:
            self._runtime_config = None
            return build_settings_config()


def resolve_base_url_for_provider(provider: LlmProvider, base_url: str | None) -> str | None:
    if provider == "ollama":
        return base_url or settings.ollama_base_url
    if provider == "openai":
        return base_url or settings.openai_base_url
    return base_url or settings.openai_base_url


def build_settings_config() -> EffectiveLlmConfig:
    provider = settings.llm_default_provider

    if provider == "ollama":
        return EffectiveLlmConfig(
            provider="ollama",
            model=settings.ollama_model,
            base_url=settings.ollama_base_url,
            api_key=None,
            temperature=settings.ollama_temperature,
            max_tokens=settings.llm_max_tokens,
            timeout_seconds=settings.ollama_timeout_seconds,
            source="settings",
        )

    return EffectiveLlmConfig(
        provider=provider,
        model=settings.openai_model,
        base_url=resolve_base_url_for_provider(provider, settings.openai_base_url),
        api_key=settings.openai_api_key,
        temperature=settings.openai_temperature,
        max_tokens=settings.openai_max_tokens,
        timeout_seconds=settings.llm_timeout_seconds,
        source="settings",
    )


def public_ai_config_payload(config: EffectiveLlmConfig) -> LlmConfigResponse:
    return LlmConfigResponse(
        provider=config.provider,
        model=config.model,
        base_url=config.base_url,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        timeout_seconds=config.timeout_seconds,
        source=config.source,
        has_custom_api_key=config.has_api_key,
        default_provider="ollama",
    )


def with_overrides(
    config: EffectiveLlmConfig,
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> EffectiveLlmConfig:
    """Return a copy with per-call generation overrides."""
    next_config = config
    if temperature is not None:
        next_config = replace(next_config, temperature=temperature)
    if max_tokens is not None:
        next_config = replace(next_config, max_tokens=max_tokens)
    return next_config


llm_runtime_config_store = LlmRuntimeConfigStore()
