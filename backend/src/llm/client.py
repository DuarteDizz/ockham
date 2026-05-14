"""Client entrypoint for Ockham LLM ranking."""

from loguru import logger

from src.config import settings
from src.llm.payloads import build_prompt_payload
from src.llm.provider import (
    get_llm_provider_name,
    invoke_llm_ranking,
    invoke_llm_ranking_repair,
)
from src.llm.runtime_config import llm_runtime_config_store
from src.llm.parser import parse_llm_decision
from src.llm.schemas import LlmRankingResult, LlmRankingStatus, OckhamRankingDecision
from src.llm.text_utils import read_message_text, shorten_text
from src.ml.contracts import OckhamEvidenceItem


FALLBACK_PROVIDER_NAME = "deterministic_score_fallback"
MISSING_RANK_SORT_VALUE = 999_999
MISSING_SCORE_SORT_VALUE = float("inf")


def classify_llm_error(exc: Exception) -> LlmRankingStatus:
    """Map provider and parser failures to a small public status set."""
    error_message = str(exc).lower()

    if "model failed to load" in error_message or "resource limitations" in error_message:
        return "provider_resource_error"
    if "status code: 500" in error_message or "internal error" in error_message:
        return "provider_internal_error"
    if "invalid prompt input" in error_message or "missing variables" in error_message:
        return "invalid_prompt_input"
    if "json" in error_message or "validation" in error_message:
        return "invalid_output"
    return "invoke_error"


def is_repairable_llm_output_error(exc: Exception) -> bool:
    """Return True when a second repair pass is worth attempting."""
    error_message = str(exc).lower()

    repairable_patterns = (
        "does not contain a valid json object",
        "response json must be an object",
        "returned an empty response",
        "unknown model_id",
        "contains duplicate model_ids",
        "does not cover all candidate model_ids exactly once",
        "recommended_model_id does not match rank 1",
        "validation error for ockhamrankingdecision",
        "ranking is empty",
        "does not define a valid rank 1 candidate",
    )

    return any(pattern in error_message for pattern in repairable_patterns)


def make_fallback_sort_key(item: OckhamEvidenceItem) -> tuple[int, float]:
    """Keep the deterministic fallback tied to the existing score ranking."""
    performance_rank = item.result.performance_rank
    best_score = item.result.best_score

    safe_rank = int(performance_rank) if performance_rank is not None else MISSING_RANK_SORT_VALUE
    safe_score = -float(best_score) if best_score is not None else MISSING_SCORE_SORT_VALUE
    return safe_rank, safe_score


def build_fallback_ranking_result(
    evidence_items: list[OckhamEvidenceItem],
    status: LlmRankingStatus,
    error: str | None = None,
) -> LlmRankingResult:
    """Return a deterministic ranking when the LLM path is unavailable."""
    ranked_items = list(evidence_items)
    ranked_items.sort(key=make_fallback_sort_key)
    ranked_model_ids = [item.result.model_id for item in ranked_items]

    decision = OckhamRankingDecision.model_validate(
        {
            "recommended_model_id": ranked_model_ids[0],
            "ranked_model_ids": ranked_model_ids,
        }
    )

    logger.warning(
        "Using deterministic LLM fallback. status={} recommended_model_id={} ranked_count={} error={}",
        status,
        decision.recommended_model_id,
        len(decision.ranked_model_ids),
        shorten_text(error),
    )

    return LlmRankingResult(
        provider=FALLBACK_PROVIDER_NAME,
        status=status,
        error=error,
        decision=decision,
    )


def attempt_repair_after_parse_failure(
    *,
    original_message,
    original_error: Exception,
    prompt_payload: dict[str, str],
    evidence_items: list[OckhamEvidenceItem],
    candidate_id_map: dict[str, str],
):
    """Ask the LLM to repair a nearly-correct response before falling back."""
    repair_payload = {
        "allowed_candidate_ids_json": prompt_payload["allowed_candidate_ids_json"],
        "previous_response_text": read_message_text(original_message).strip(),
        "validation_error": str(original_error),
    }

    effective_config = llm_runtime_config_store.get_effective_config()
    logger.warning(
        "LLM output invalid but repairable. Attempting repair. model={} error={}",
        effective_config.model,
        shorten_text(original_error),
    )

    repair_message = invoke_llm_ranking_repair(repair_payload)
    repaired_decision = parse_llm_decision(repair_message, evidence_items, candidate_id_map)

    logger.info(
        "LLM repair succeeded. model={} recommended_model_id={} ranked_count={}",
        effective_config.model,
        repaired_decision.recommended_model_id,
        len(repaired_decision.ranked_model_ids),
    )

    return repaired_decision


def rank_models_with_llm(evidence_items: list[OckhamEvidenceItem]) -> LlmRankingResult:
    """Ask the provider to rank the candidates or fall back deterministically."""
    if not evidence_items:
        raise ValueError("evidence_items cannot be empty.")

    effective_config = llm_runtime_config_store.get_effective_config()
    logger.info(
        "LLM ranking request received. candidates={} enabled={} provider={} model={} base_url={} timeout={} retries={} has_api_key={}",
        len(evidence_items),
        settings.enable_llm_ranking,
        effective_config.provider,
        effective_config.model,
        effective_config.base_url,
        effective_config.timeout_seconds,
        settings.ollama_max_retries,
        effective_config.has_api_key,
    )

    if not settings.enable_llm_ranking:
        logger.warning(
            "LLM ranking is disabled in settings. model={} Using deterministic fallback.",
            effective_config.model,
        )
        return build_fallback_ranking_result(evidence_items, status="disabled")

    try:
        prompt_payload, candidate_id_map = build_prompt_payload(evidence_items)
        provider_message = invoke_llm_ranking(prompt_payload)

        try:
            decision = parse_llm_decision(provider_message, evidence_items, candidate_id_map)
        except Exception as parse_error:
            if not is_repairable_llm_output_error(parse_error):
                raise

            decision = attempt_repair_after_parse_failure(
                original_message=provider_message,
                original_error=parse_error,
                prompt_payload=prompt_payload,
                evidence_items=evidence_items,
                candidate_id_map=candidate_id_map,
            )

    except Exception as exc:
        status = classify_llm_error(exc)
        logger.exception(
            "LLM ranking invocation failed. Using deterministic fallback. status={} model={} base_url={} error={}",
            status,
            effective_config.model,
            effective_config.base_url,
            shorten_text(exc),
        )
        return build_fallback_ranking_result(evidence_items, status=status, error=str(exc))

    logger.info(
        "LLM ranking succeeded. provider={} recommended_model_id={} ranked_count={}",
        get_llm_provider_name(),
        decision.recommended_model_id,
        len(decision.ranked_model_ids),
    )
    return LlmRankingResult(
        provider=get_llm_provider_name(),
        status="ok",
        error=None,
        decision=decision,
    )