from typing import Literal, TypeAlias

from pydantic import BaseModel, ConfigDict

LlmRankingStatus: TypeAlias = Literal[
    "ok",
    "fallback",
    "disabled",
    "provider_resource_error",
    "provider_internal_error",
    "invalid_prompt_input",
    "invalid_output",
    "invoke_error",
]


class OckhamRankingDecision(BaseModel):
    recommended_model_id: str
    ranked_model_ids: list[str]


class LlmRankingResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider: str
    status: LlmRankingStatus
    error: str | None = None
    decision: OckhamRankingDecision
