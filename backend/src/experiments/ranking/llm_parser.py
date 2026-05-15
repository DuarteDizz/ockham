"""Parse and validate the LLM ranking response."""

import json
from typing import Any

from loguru import logger

from src.experiments.ranking.schemas import OckhamRankingDecision
from src.ai.text_utils import read_message_text, shorten_text
from src.modeling.contracts import OckhamEvidenceItem


RECOMMENDED_MODEL_FIELD_NAMES = (
    "recommended_model_id",
    "selected_model_id",
    "chosen_model_id",
    "best_model_id",
)

RANKED_MODEL_FIELD_NAMES = (
    "ranked_model_ids",
    "ranking",
    "ordered_model_ids",
    "ranked_candidates",
    "ordered_candidates",
)


def extract_json_payload(text: str) -> dict[str, Any]:
    """Extract the JSON object returned by the LLM."""
    cleaned_text = text.strip()

    if cleaned_text.startswith("```"):
        cleaned_text = cleaned_text.strip("`")
        if cleaned_text.startswith("json\n"):
            cleaned_text = cleaned_text[5:]
        cleaned_text = cleaned_text.strip()

    try:
        raw_payload = json.loads(cleaned_text)
    except json.JSONDecodeError:
        start = cleaned_text.find("{")
        end = cleaned_text.rfind("}")

        if start < 0 or end <= start:
            raise ValueError("LLM response does not contain a valid JSON object.")

        raw_payload = json.loads(cleaned_text[start : end + 1])

    if not isinstance(raw_payload, dict):
        raise ValueError("LLM response JSON must be an object.")

    return raw_payload


def normalize_candidate_id(value: Any, candidate_id_map: dict[str, str]) -> str | None:
    """Normalize candidate ids while staying tolerant to casing differences."""
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    if text in candidate_id_map:
        return text

    lowered_text = text.lower()
    for candidate_id in candidate_id_map:
        if candidate_id.lower() == lowered_text:
            return candidate_id

    return None


def read_recommended_candidate_id(
    payload: dict[str, Any],
    candidate_id_map: dict[str, str],
) -> str | None:
    """Read an optional recommended candidate id across known aliases."""
    for field_name in RECOMMENDED_MODEL_FIELD_NAMES:
        value = payload.get(field_name)
        if value is None:
            continue

        candidate_id = normalize_candidate_id(value, candidate_id_map)
        if candidate_id is not None:
            return candidate_id

    return None


def read_ranked_candidate_ids(
    payload: dict[str, Any],
    candidate_id_map: dict[str, str],
) -> list[str]:
    """Read the ranked candidate ids across the known ranking field aliases."""
    ranking_value = None

    for field_name in RANKED_MODEL_FIELD_NAMES:
        value = payload.get(field_name)
        if value is not None:
            ranking_value = value
            break

    if not isinstance(ranking_value, list):
        return []

    ranked_candidate_ids: list[str] = []

    for item in ranking_value:
        candidate_value = item

        if isinstance(item, dict):
            if item.get("candidate_id") is not None:
                candidate_value = item["candidate_id"]
            elif item.get("id") is not None:
                candidate_value = item["id"]
            else:
                candidate_value = item.get("model_id")

        candidate_id = normalize_candidate_id(candidate_value, candidate_id_map)
        if candidate_id is None:
            continue
        if candidate_id in ranked_candidate_ids:
            continue

        ranked_candidate_ids.append(candidate_id)

    return ranked_candidate_ids


def reconcile_ranking_only_output(
    recommended_candidate_id: str | None,
    ranked_candidate_ids: list[str],
) -> tuple[str | None, list[str]]:
    """Normalize ranked output and infer recommended_model_id from rank 1.

    The LLM is now allowed to return only:
    {
      "ranked_model_ids": [...]
    }

    In that case, recommended_model_id is inferred from the first ranking item.

    If the LLM still returns recommended_model_id, we keep it compatible by
    reconciling it with the ranking.
    """
    normalized_ranking: list[str] = []
    for candidate_id in ranked_candidate_ids:
        if candidate_id not in normalized_ranking:
            normalized_ranking.append(candidate_id)

    if recommended_candidate_id is None:
        if normalized_ranking:
            recommended_candidate_id = normalized_ranking[0]
        return recommended_candidate_id, normalized_ranking

    if recommended_candidate_id in normalized_ranking:
        normalized_ranking = [recommended_candidate_id] + [
            candidate_id
            for candidate_id in normalized_ranking
            if candidate_id != recommended_candidate_id
        ]
    else:
        normalized_ranking = [recommended_candidate_id] + normalized_ranking

    return recommended_candidate_id, normalized_ranking


def parse_llm_decision(
    message: Any,
    evidence_items: list[OckhamEvidenceItem],
    candidate_id_map: dict[str, str],
) -> OckhamRankingDecision:
    """Parse the LLM answer and validate it against the expected candidate set."""
    text = read_message_text(message).strip()

    logger.info(
        "LLM response text received. content_chars={} preview={}",
        len(text),
        shorten_text(text),
    )

    if not text:
        raise ValueError("LLM returned an empty response.")

    raw_payload = extract_json_payload(text)
    logger.info("LLM response JSON extracted. keys={}", sorted(raw_payload.keys()))

    recommended_candidate_id = read_recommended_candidate_id(raw_payload, candidate_id_map)
    ranked_candidate_ids = read_ranked_candidate_ids(raw_payload, candidate_id_map)

    recommended_candidate_id, ranked_candidate_ids = reconcile_ranking_only_output(
        recommended_candidate_id,
        ranked_candidate_ids,
    )

    if not ranked_candidate_ids:
        raise ValueError("LLM ranking is empty.")

    if recommended_candidate_id is None:
        raise ValueError("LLM ranking does not define a valid rank 1 candidate.")

    candidate_decision = OckhamRankingDecision.model_validate(
        {
            "recommended_model_id": recommended_candidate_id,
            "ranked_model_ids": ranked_candidate_ids,
        }
    )

    decision = OckhamRankingDecision.model_validate(
        {
            "recommended_model_id": candidate_id_map[candidate_decision.recommended_model_id],
            "ranked_model_ids": [
                candidate_id_map[candidate_id]
                for candidate_id in candidate_decision.ranked_model_ids
            ],
        }
    )

    expected_model_ids = [item.result.model_id for item in evidence_items]
    expected_set = set(expected_model_ids)
    ranked_set = set(decision.ranked_model_ids)

    if decision.recommended_model_id not in expected_set:
        raise ValueError("LLM ranking recommended an unknown model_id.")

    if len(decision.ranked_model_ids) != len(ranked_set):
        raise ValueError("LLM ranking contains duplicate model_ids.")

    if ranked_set != expected_set:
        missing = sorted(expected_set - ranked_set)
        extra = sorted(ranked_set - expected_set)
        raise ValueError(
            "LLM ranking does not cover all candidate model_ids exactly once. "
            f"missing={missing} extra={extra}"
        )

    if decision.ranked_model_ids[0] != decision.recommended_model_id:
        raise ValueError("LLM ranking recommended_model_id does not match rank 1.")

    logger.info(
        "LLM decision parsed and validated. recommended_model_id={} ranked_count={}",
        decision.recommended_model_id,
        len(decision.ranked_model_ids),
    )

    return decision