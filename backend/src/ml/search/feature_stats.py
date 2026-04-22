"""Model feature-usage and inference-time helpers."""

import time

import numpy as np


def extract_feature_stats(best_estimator, X):
    total_feature_count = int(X.shape[1])
    expanded_feature_count = total_feature_count
    used_feature_count = total_feature_count
    estimator_to_inspect = best_estimator

    if hasattr(best_estimator, "named_steps"):
        named_steps = getattr(best_estimator, "named_steps", {})
        poly = named_steps.get("poly")

        if poly is not None and hasattr(poly, "n_output_features_"):
            expanded_feature_count = int(poly.n_output_features_)
            used_feature_count = expanded_feature_count

        estimator_to_inspect = (
            named_steps.get("linear") or named_steps.get("model") or estimator_to_inspect
        )

    if hasattr(estimator_to_inspect, "coef_"):
        coef = np.asarray(estimator_to_inspect.coef_)

        if coef.ndim == 1:
            active_mask = np.abs(coef) > 1e-8
        else:
            active_mask = np.any(np.abs(coef) > 1e-8, axis=0)

        if active_mask.size:
            used_feature_count = max(1, int(active_mask.sum()))

    elif hasattr(estimator_to_inspect, "feature_importances_"):
        importances = np.asarray(estimator_to_inspect.feature_importances_)

        if importances.size:
            used_feature_count = max(1, int((np.abs(importances) > 1e-8).sum()))

    effective_reference = max(expanded_feature_count, total_feature_count, 1)

    return {
        "used_feature_count": float(used_feature_count),
        "total_feature_count": float(total_feature_count),
        "expanded_feature_count": float(expanded_feature_count),
        "used_feature_ratio": float(used_feature_count / effective_reference),
    }


def measure_inference_time_per_1000_rows(best_estimator, X):
    started_at = time.perf_counter()
    best_estimator.predict(X)
    elapsed_seconds = time.perf_counter() - started_at

    return float(elapsed_seconds / len(X) * 1000)
