"""Cross-validation helpers used by the model search flow."""

from sklearn.model_selection import KFold, StratifiedKFold


def build_cv(problem_type, y, cv_folds, random_state):
    """Build a CV splitter that matches the problem type and dataset size.

    Classification uses stratification and also needs to respect the smallest
    class support. Regression can use a plain shuffled KFold bounded only by
    the number of available rows.
    """
    if problem_type == "classification":
        min_class_count = int(y.value_counts().min())
        effective_folds = min(cv_folds, min_class_count)

        if effective_folds < 2:
            raise ValueError("Each class must have at least 2 samples for cross-validation.")

        return StratifiedKFold(
            n_splits=effective_folds,
            shuffle=True,
            random_state=random_state,
        ), effective_folds

    if problem_type == "regression":
        effective_folds = min(cv_folds, len(y))

        if effective_folds < 2:
            raise ValueError("Regression dataset must have at least 2 rows.")

        return KFold(
            n_splits=effective_folds,
            shuffle=True,
            random_state=random_state,
        ), effective_folds

    raise ValueError(f"Unsupported problem_type: {problem_type}")


def build_scoring(model_config):
    """Return the primary metric and sklearn scoring map for a model."""
    primary_metric = model_config.primary_metric
    scoring = {primary_metric: primary_metric}

    # Secondary metrics are exposed to Optuna and later reused by diagnostics
    # and ranking, so we keep them in the same scoring payload.
    for metric_name in model_config.secondary_metrics:
        scoring[metric_name] = metric_name

    return primary_metric, scoring
