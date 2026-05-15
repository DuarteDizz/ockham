"""AI runtime configuration endpoints.

API keys submitted here are accepted by the backend, kept in memory, and never
returned to the frontend. The default configuration remains local Ollama.
"""

from fastapi import APIRouter, HTTPException

from src.ai.runtime_config import (
    LlmConfigResponse,
    LlmConfigUpdateRequest,
    llm_runtime_config_store,
    public_ai_config_payload,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/config", response_model=LlmConfigResponse)
def get_ai_config() -> LlmConfigResponse:
    """Return the active AI configuration without exposing secrets."""
    config = llm_runtime_config_store.get_effective_config()
    return public_ai_config_payload(config)


@router.post("/config", response_model=LlmConfigResponse)
def update_ai_config(payload: LlmConfigUpdateRequest) -> LlmConfigResponse:
    """Update the backend-only runtime AI configuration.

    The API key may be sent to this endpoint, but it is not persisted and is not
    included in the response payload.
    """
    if payload.provider in {"openai", "openai_compatible"}:
        has_submitted_key = bool(payload.api_key and payload.api_key.get_secret_value().strip())
        existing = llm_runtime_config_store.get_effective_config()
        has_existing_key = existing.provider == payload.provider and existing.has_api_key

        if payload.clear_api_key or (not has_submitted_key and not has_existing_key):
            raise HTTPException(
                status_code=400,
                detail="The selected provider requires an API key.",
            )

    config = llm_runtime_config_store.update(payload)
    return public_ai_config_payload(config)


@router.post("/config/reset", response_model=LlmConfigResponse)
def reset_ai_config() -> LlmConfigResponse:
    """Reset the runtime config to settings defaults, usually Ollama."""
    config = llm_runtime_config_store.reset()
    return public_ai_config_payload(config)
