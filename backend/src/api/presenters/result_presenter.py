"""Result presenters used by the experiment dashboard and diagnostics views."""

from src.ml.models.model_specs import serialize_search_params
from src.ml.models.registry import get_model_config
from src.ml.search.search_space import effective_n_trials as effective_n_iter
from src.utils.core import clamp

_DEFAULT_N_TRIALS = 10
_DEFAULT_CAPABILITY_SUMMARY = (
    "Capability profile separates structural traits from measured execution evidence."
)
_ANALYSIS_CONTEXT_KEYS = (
    "score_context",
    "performance_evidence",
    "structural_profile",
    "execution_profile",
    "feature_usage_context",
    "operational_context",
)


def build_optuna_payload(
    *,
    model_id,
    best_params,
    best_score,
    total_search_time,
    best_trial_number=None,
    search_params=None,
    requested_n_trials=_DEFAULT_N_TRIALS,
):
    """Build the lightweight Optuna payload used by the dashboard."""
    model = get_model_config(model_id)
    resolved_search_params = (
        search_params if search_params is not None else model.get_search_params()
    )
    n_trials = effective_n_iter(resolved_search_params, requested_n_trials)

    resolved_best_params = {} if best_params is None else dict(best_params)

    return {
        "search_backend": model.search_backend,
        "best_value": best_score,
        "best_params": resolved_best_params,
        "duration_seconds": total_search_time,
        "n_trials": n_trials,
        "search_space": serialize_search_params(resolved_search_params),
        "best_trial": {
            "number": best_trial_number,
            "value": best_score,
            "params": resolved_best_params,
        },
    }


def read_analysis_context(components):
    """Read the Ockham analysis blocks using a stable set of expected keys."""
    context = {}
    for key in _ANALYSIS_CONTEXT_KEYS:
        component = components.get(key)
        if component is None:
            context[key] = {}
        else:
            context[key] = dict(component)
    return context


def read_record_analysis_context(record):
    components = {} if record.ockham_components is None else record.ockham_components
    return read_analysis_context(components)


def read_result_item_analysis_context(item):
    if "score_context" in item and "performance_evidence" in item:
        return read_analysis_context(item)

    components = item.get("ockham_components")
    if components is None:
        components = {}
    return read_analysis_context(components)


def embedded_diagnostics_payload(record, best_params):
    """Expose the embedded diagnostics block used by the result cards."""
    from src.ml.search.search_space import get_available_validation_params

    search_params = get_model_config(record.model_id).get_search_params()
    available_validation_params = get_available_validation_params(search_params, best_params)

    validation_bundle = {} if record.validation_curve is None else record.validation_curve
    selected_validation_param = validation_bundle.get("default_param")
    if selected_validation_param not in available_validation_params:
        selected_validation_param = (
            available_validation_params[0] if available_validation_params else None
        )

    curves = validation_bundle.get("curves", {})
    validation_curve = None
    if selected_validation_param is not None:
        validation_curve = curves.get(selected_validation_param)

    cv_fold_scores = {} if record.cv_fold_scores is None else dict(record.cv_fold_scores)

    return {
        "cv_fold_scores": cv_fold_scores,
        "confusion_matrix": record.confusion_matrix,
        "roc_curve": record.roc_curve,
        "learning_curve": record.learning_curve,
        "validation_curve": validation_curve,
        "actual_vs_predicted": record.actual_vs_predicted,
        "available_validation_params": available_validation_params,
        "selected_validation_param": selected_validation_param,
    }


def build_capability_profiles(result_items):
    """Build the capability profile cards shown beside ranked results."""
    profiles = {}

    for item in result_items:
        context = read_result_item_analysis_context(item)
        structural_profile = context["structural_profile"]
        execution_profile = context["execution_profile"]

        structural_dimensions = [
            {
                "key": "simplicity",
                "label": "Simplicity",
                "group": "structural",
                "score": round(100 * clamp(structural_profile.get("simplicity", 0.0)), 1),
            },
            {
                "key": "interpretability",
                "label": "Interpretability",
                "group": "structural",
                "score": round(100 * clamp(structural_profile.get("interpretability", 0.0)), 1),
            },
            {
                "key": "scalability",
                "label": "Scalability",
                "group": "structural",
                "score": round(100 * clamp(structural_profile.get("scalability", 0.0)), 1),
            },
        ]
        execution_dimensions = [
            {
                "key": "stability",
                "label": "Stability",
                "group": "execution",
                "score": round(100 * clamp(execution_profile.get("stability", 0.0)), 1),
            },
            {
                "key": "feature_efficiency",
                "label": "Feature Efficiency",
                "group": "execution",
                "score": round(100 * clamp(execution_profile.get("feature_efficiency", 0.0)), 1),
            },
            {
                "key": "operational_efficiency",
                "label": "Operational Efficiency",
                "group": "execution",
                "score": round(
                    100 * clamp(execution_profile.get("operational_efficiency", 0.0)), 1
                ),
            },
        ]
        dimensions = structural_dimensions + execution_dimensions
        radar_axes = [
            {"subject": dimension["label"], "value": dimension["score"]} for dimension in dimensions
        ]

        summary_text = _DEFAULT_CAPABILITY_SUMMARY
        if "ockham_components" in item:
            llm_summary = item["ockham_components"].get("llm_summary")
            if llm_summary is not None:
                summary_text = llm_summary

        profiles[item["model_id"]] = {
            "summary": {"why_ockham_likes_this_model": summary_text},
            "sections": [
                {
                    "key": "structural_profile",
                    "label": "Structural Profile",
                    "dimensions": structural_dimensions,
                },
                {
                    "key": "execution_profile",
                    "label": "Execution Profile",
                    "dimensions": execution_dimensions,
                },
            ],
            "dimensions": dimensions,
            "radar_axes": radar_axes,
        }

    return profiles


def build_result_payload(record):
    """Build the common result payload shared by result and diagnostics routes."""
    best_params = {} if record.best_params is None else dict(record.best_params)
    metrics_mean = {} if record.metrics_mean is None else dict(record.metrics_mean)
    metrics_std = {} if record.metrics_std is None else dict(record.metrics_std)
    cv_fold_scores = {} if record.cv_fold_scores is None else dict(record.cv_fold_scores)

    optuna_payload = record.optuna_payload
    if optuna_payload is None:
        optuna_payload = build_optuna_payload(
            model_id=record.model_id,
            best_params=best_params,
            best_score=record.best_score,
            total_search_time=record.total_search_time,
        )

    analysis_context = read_record_analysis_context(record)
    ockham_components = {} if record.ockham_components is None else dict(record.ockham_components)
    payload = {
        "model_id": record.model_id,
        "model_name": record.model_name,
        "category": record.category,
        "problem_type": record.problem_type,
        "primary_metric": record.primary_metric,
        "best_score": record.best_score,
        "best_params": best_params,
        "metrics_mean": metrics_mean,
        "metrics_std": metrics_std,
        "fit_time_mean": record.fit_time_mean,
        "total_search_time": record.total_search_time,
        "inference_time_per_1000_rows": record.inference_time_per_1000_rows,
        "performance_rank": record.performance_rank,
        "ockham_rank": record.ockham_rank,
        "is_ockham_recommended": record.is_ockham_recommended,
        "cv_fold_scores": cv_fold_scores,
        "ockham_components": ockham_components,
        "optuna": optuna_payload,
    }
    payload.update(analysis_context)
    return payload


def result_payload(record):
    return build_result_payload(record)


def diagnostics_payload(record, diagnostics):
    payload = build_result_payload(record)
    payload["experiment_id"] = record.experiment_id
    payload.update(diagnostics)
    return payload


def result_payload_with_embedded(record):
    best_params = {} if record.best_params is None else dict(record.best_params)
    payload = build_result_payload(record)
    payload["embedded_diagnostics"] = embedded_diagnostics_payload(record, best_params)
    return payload


def attach_capability_profiles(result_items):
    """Attach the precomputed capability profile to each serialized result."""
    profiles = build_capability_profiles(result_items)
    enriched = []

    for item in result_items:
        next_item = dict(item)
        next_item["capability_profile"] = profiles.get(item["model_id"])
        enriched.append(next_item)

    return enriched
