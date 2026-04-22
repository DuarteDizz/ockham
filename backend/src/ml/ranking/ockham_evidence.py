"""Build the evidence blocks consumed by Ockham ranking and capability views."""

from math import isnan

from src.ml.contracts import (
    ExecutionProfile,
    FeatureUsageContext,
    OckhamEvidenceItem,
    OperationalContext,
    PerformanceEvidence,
    PrimaryMetricEvidence,
    ScoreContext,
    StructuralProfile,
)
from src.utils.core import clamp

STRUCTURAL_SCORE_SCALE_MAX = 5.0


def read_primary_metric_mean(result):
    """Return the comparable primary metric mean for one result."""
    metric_name = result.primary_metric
    value = result.metrics_mean[metric_name]
    if metric_name.startswith("neg_"):
        return abs(value)
    return value


def read_primary_metric_std(result):
    """Return the primary metric dispersion used for stability scoring."""
    metric_name = result.primary_metric
    return abs(result.metrics_std[metric_name])


def read_primary_metric_folds(result):
    metric_name = result.primary_metric
    return list(result.cv_fold_scores[metric_name])


def round_value(value):
    return round(value, 6)


def get_peer_range(values):
    if not values:
        raise ValueError("Cannot normalize an empty peer set.")
    if any(isnan(value) for value in values):
        raise ValueError("Cannot normalize peer values containing NaN.")
    return min(values), max(values)


def normalize_peer_value(value, low, high, higher_is_better=True):
    if isnan(value):
        raise ValueError("Cannot normalize a NaN value.")

    if high == low:
        return 1.0

    normalized = (value - low) / (high - low)
    if not higher_is_better:
        normalized = 1.0 - normalized
    return clamp(normalized)


def normalize_structural_score(structural_scores, key):
    return clamp(structural_scores[key] / STRUCTURAL_SCORE_SCALE_MAX)


def make_score_context(score_leader, candidate):
    """Describe how far the candidate is from the raw score leader."""
    score_leader_value = read_primary_metric_mean(score_leader)
    candidate_value = read_primary_metric_mean(candidate)
    score_gap = max(score_leader_value - candidate_value, 0.0)

    if score_leader_value == 0:
        score_gap_ratio = 0.0
    else:
        score_gap_ratio = score_gap / abs(score_leader_value)

    return ScoreContext(
        score_leader_model_id=score_leader.model_id,
        score_leader_model_name=score_leader.model_name,
        best_score=round_value(candidate.best_score),
        performance_rank=int(candidate.performance_rank),
        score_gap_to_leader=round_value(score_gap),
        score_gap_ratio=round_value(score_gap_ratio),
    )


def build_ockham_evidence(score_ranked_results):
    """Normalize the ranked search results into Ockham evidence items."""
    if not score_ranked_results:
        return []

    score_leader = min(score_ranked_results, key=lambda item: item.performance_rank)

    # Every candidate is normalized against the same peer ranges so the LLM sees
    # comparable execution and structural evidence across the whole experiment.
    peer_metric_means = []
    peer_metric_stds = []
    peer_feature_counts = []
    peer_feature_ratios = []
    peer_fit_times = []
    peer_inference_times = []

    for item in score_ranked_results:
        peer_metric_means.append(read_primary_metric_mean(item))
        peer_metric_stds.append(read_primary_metric_std(item))
        peer_feature_counts.append(item.structural_scores["used_feature_count"])
        peer_feature_ratios.append(item.structural_scores["used_feature_ratio"])
        peer_fit_times.append(item.fit_time_mean)
        peer_inference_times.append(item.inference_time_per_1000_rows)

    metric_low, metric_high = get_peer_range(peer_metric_means)
    stability_low, stability_high = get_peer_range(peer_metric_stds)
    feature_count_low, feature_count_high = get_peer_range(peer_feature_counts)
    feature_ratio_low, feature_ratio_high = get_peer_range(peer_feature_ratios)
    fit_time_low, fit_time_high = get_peer_range(peer_fit_times)
    inference_time_low, inference_time_high = get_peer_range(peer_inference_times)

    evidence_items = []

    for result in score_ranked_results:
        metric_mean = read_primary_metric_mean(result)
        metric_std = read_primary_metric_std(result)
        metric_folds = read_primary_metric_folds(result)
        structural_scores = result.structural_scores

        simplicity = normalize_structural_score(structural_scores, "simplicity_score")
        interpretability = normalize_structural_score(structural_scores, "interpretability_score")
        scalability = normalize_structural_score(structural_scores, "scalability_score")

        used_feature_count = structural_scores["used_feature_count"]
        used_feature_ratio = structural_scores["used_feature_ratio"]
        expanded_feature_count = structural_scores["expanded_feature_count"]
        total_feature_count = structural_scores["total_feature_count"]

        count_efficiency = normalize_peer_value(
            used_feature_count,
            feature_count_low,
            feature_count_high,
            higher_is_better=False,
        )
        ratio_efficiency = normalize_peer_value(
            used_feature_ratio,
            feature_ratio_low,
            feature_ratio_high,
            higher_is_better=False,
        )
        feature_efficiency = clamp((count_efficiency + ratio_efficiency) / 2.0)

        training_efficiency = normalize_peer_value(
            result.fit_time_mean,
            fit_time_low,
            fit_time_high,
            higher_is_better=False,
        )
        inference_efficiency = normalize_peer_value(
            result.inference_time_per_1000_rows,
            inference_time_low,
            inference_time_high,
            higher_is_better=False,
        )
        operational_efficiency = clamp((training_efficiency + inference_efficiency) / 2.0)
        stability = normalize_peer_value(
            metric_std,
            stability_low,
            stability_high,
            higher_is_better=False,
        )
        normalized_metric = normalize_peer_value(
            metric_mean,
            metric_low,
            metric_high,
            higher_is_better=True,
        )

        structural_profile = StructuralProfile(
            simplicity=round_value(simplicity),
            interpretability=round_value(interpretability),
            scalability=round_value(scalability),
        )
        execution_profile = ExecutionProfile(
            stability=round_value(stability),
            feature_efficiency=round_value(feature_efficiency),
            training_efficiency=round_value(training_efficiency),
            inference_efficiency=round_value(inference_efficiency),
            operational_efficiency=round_value(operational_efficiency),
        )
        feature_usage_context = FeatureUsageContext(
            used_feature_count=round_value(used_feature_count),
            used_feature_ratio=round_value(used_feature_ratio),
            relative_count_efficiency=round_value(count_efficiency),
            relative_ratio_efficiency=round_value(ratio_efficiency),
            expanded_feature_count=round_value(expanded_feature_count),
            total_feature_count=round_value(total_feature_count),
        )
        operational_context = OperationalContext(
            fit_time_mean=round_value(result.fit_time_mean),
            score_time_mean=round_value(result.score_time_mean),
            total_search_time=round_value(result.total_search_time),
            inference_time_per_1000_rows=round_value(result.inference_time_per_1000_rows),
        )
        performance_evidence = PerformanceEvidence(
            primary_metric=PrimaryMetricEvidence(
                metric_name=result.primary_metric,
                mean=round_value(metric_mean),
                std=round_value(metric_std),
                normalized_against_peers=round_value(normalized_metric),
                higher_is_better=True,
            ),
            metrics_mean={key: round_value(value) for key, value in result.metrics_mean.items()},
            metrics_std={key: round_value(value) for key, value in result.metrics_std.items()},
            cv_folds=len(metric_folds),
            cv_primary_fold_scores=[round_value(value) for value in metric_folds],
        )
        score_context = make_score_context(score_leader, result)

        evidence_item = OckhamEvidenceItem(
            result=result,
            score_context=score_context,
            performance_evidence=performance_evidence,
            structural_profile=structural_profile,
            execution_profile=execution_profile,
            feature_usage_context=feature_usage_context,
            operational_context=operational_context,
        )
        evidence_items.append(evidence_item)

    return evidence_items
