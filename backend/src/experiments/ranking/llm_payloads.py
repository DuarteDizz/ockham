"""Build the structured evidence payload consumed by the LLM ranker."""

import hashlib
import json
import random

from loguru import logger

from src.ai.text_utils import shorten_text
from src.modeling.contracts import OckhamEvidenceItem


def shuffle_candidates_without_score_leakage(
    evidence_items: list[OckhamEvidenceItem],
) -> list[OckhamEvidenceItem]:
    """Mask candidate order so the LLM does not inherit the score ranking order.

    The shuffle is deterministic for a given candidate set, which keeps logs and
    debugging reproducible while still breaking the original score-ranked order.
    """
    canonical_items = sorted(evidence_items, key=lambda item: item.result.model_id)
    seed_source = "|".join(item.result.model_id for item in canonical_items)
    seed_value = int(hashlib.sha256(seed_source.encode("utf-8")).hexdigest()[:16], 16)

    rng = random.Random(seed_value)
    shuffled_items = list(canonical_items)
    rng.shuffle(shuffled_items)
    return shuffled_items


def build_prompt_payload(
    evidence_items: list[OckhamEvidenceItem],
) -> tuple[dict[str, str], dict[str, str]]:
    """Serialize ranking evidence and keep a private candidate-to-model mapping."""
    shuffled_items = shuffle_candidates_without_score_leakage(evidence_items)

    candidates = []
    candidate_id_map: dict[str, str] = {}

    for index, item in enumerate(shuffled_items, start=1):
        candidate_id = f"candidate_{index}"
        candidate_id_map[candidate_id] = item.result.model_id
        primary_metric_name = item.performance_evidence.primary_metric.metric_name

        predictive_evidence = {
            "primary_metric_name": primary_metric_name,
            "primary_metric_mean": item.performance_evidence.primary_metric.mean,
            "primary_metric_std": item.performance_evidence.primary_metric.std,
            "cv_primary_fold_scores": list(item.performance_evidence.cv_primary_fold_scores),
            "secondary_metrics_mean": {
                metric_name: metric_value
                for metric_name, metric_value in item.performance_evidence.metrics_mean.items()
                if metric_name != primary_metric_name
            },
            "secondary_metrics_std": {
                metric_name: metric_value
                for metric_name, metric_value in item.performance_evidence.metrics_std.items()
                if metric_name != primary_metric_name
            },
        }
        execution_evidence = {
            "stability": item.execution_profile.stability,
            "feature_efficiency": item.execution_profile.feature_efficiency,
            "training_efficiency": item.execution_profile.training_efficiency,
            "inference_efficiency": item.execution_profile.inference_efficiency,
            "operational_efficiency": item.execution_profile.operational_efficiency,
            "fit_time_mean": item.operational_context.fit_time_mean,
            "score_time_mean": item.operational_context.score_time_mean,
            "inference_time_per_1000_rows": item.operational_context.inference_time_per_1000_rows,
            "total_search_time": item.operational_context.total_search_time,
            "used_feature_count": item.feature_usage_context.used_feature_count,
            "used_feature_ratio": item.feature_usage_context.used_feature_ratio,
            "expanded_feature_count": item.feature_usage_context.expanded_feature_count,
            "total_feature_count": item.feature_usage_context.total_feature_count,
        }
        structural_profile = {
            "simplicity": item.structural_profile.simplicity,
            "interpretability": item.structural_profile.interpretability,
            "scalability": item.structural_profile.scalability,
        }

        candidates.append(
            {
                "candidate_id": candidate_id,
                "predictive_evidence": predictive_evidence,
                "execution_evidence": execution_evidence,
                "structural_profile": structural_profile,
            }
        )

    prompt_payload = {
        "problem_type": evidence_items[0].result.problem_type,
        "primary_metric": evidence_items[0].result.primary_metric,
        "allowed_candidate_ids_json": json.dumps(list(candidate_id_map.keys()), ensure_ascii=False),
        "candidates_json": json.dumps(candidates, ensure_ascii=False, indent=2),
    }

    logger.info(
        "LLM payload built. problem_type={} primary_metric={} candidates={} allowed_ids_chars={} candidates_chars={} preview={}",
        prompt_payload["problem_type"],
        prompt_payload["primary_metric"],
        len(candidates),
        len(prompt_payload["allowed_candidate_ids_json"]),
        len(prompt_payload["candidates_json"]),
        shorten_text(prompt_payload["candidates_json"]),
    )

    return prompt_payload, candidate_id_map
