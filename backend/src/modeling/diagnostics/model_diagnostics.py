"""Visual diagnostics builders used by the ranking dashboard."""

import numpy as np
import pandas as pd
from sklearn.metrics import auc, confusion_matrix, roc_curve
from sklearn.model_selection import (
    cross_val_predict,
    cross_validate,
    learning_curve,
    validation_curve,
)

from src.modeling.registry.model_registry import build_estimator
from src.modeling.search.cross_validation import build_cv
from src.modeling.search.dataset_loader import load_numeric_dataset, prepare_model_context
from src.modeling.search.search_space import (
    get_available_validation_params,
    resolve_matching_search_space,
)

LEARNING_CURVE_TRAIN_SIZES = np.linspace(0.2, 1.0, 5)
MAX_ACTUAL_PREDICTED_POINTS = 1000


def sample_pairs(actual, predicted, max_points=MAX_ACTUAL_PREDICTED_POINTS):
    if len(actual) <= max_points:
        return {"actual": actual, "predicted": predicted}

    sampled_indices = np.linspace(0, len(actual) - 1, max_points, dtype=int)

    return {
        "actual": [actual[index] for index in sampled_indices],
        "predicted": [predicted[index] for index in sampled_indices],
    }


def build_confusion_matrix(best_estimator, X, y, cv):
    predictions = cross_val_predict(best_estimator, X, y, cv=cv, method="predict")
    labels = sorted(pd.Series(y).dropna().unique().tolist())
    matrix = confusion_matrix(y, predictions, labels=labels)

    return {
        "labels": [str(label) for label in labels],
        "matrix": matrix.tolist(),
    }


def build_roc_curve(best_estimator, X, y, cv):
    classes = sorted(pd.Series(y).dropna().unique().tolist())
    if len(classes) != 2:
        return None

    if hasattr(best_estimator, "predict_proba"):
        scores = cross_val_predict(best_estimator, X, y, cv=cv, method="predict_proba")[:, 1]
    elif hasattr(best_estimator, "decision_function"):
        scores = cross_val_predict(best_estimator, X, y, cv=cv, method="decision_function")
        if getattr(scores, "ndim", 1) > 1:
            scores = scores[:, 1]
    else:
        return None

    y_binary = (pd.Series(y).values == classes[1]).astype(int)
    fpr, tpr, thresholds = roc_curve(y_binary, scores)

    return {
        "positive_label": str(classes[1]),
        "fpr": [float(value) for value in fpr],
        "tpr": [float(value) for value in tpr],
        "thresholds": [float(value) for value in thresholds],
        "auc": float(auc(fpr, tpr)),
    }


def build_learning_curve_data(best_estimator, X, y, cv, primary_metric, random_state):
    train_sizes, train_scores, validation_scores = learning_curve(
        estimator=best_estimator,
        X=X,
        y=y,
        cv=cv,
        scoring=primary_metric,
        n_jobs=None,
        train_sizes=LEARNING_CURVE_TRAIN_SIZES,
        shuffle=True,
        random_state=random_state,
    )

    return {
        "metric": primary_metric,
        "train_sizes": [int(value) for value in train_sizes],
        "train_scores_mean": [float(value) for value in train_scores.mean(axis=1)],
        "validation_scores_mean": [float(value) for value in validation_scores.mean(axis=1)],
        "train_scores_std": [float(value) for value in train_scores.std(axis=1)],
        "validation_scores_std": [float(value) for value in validation_scores.std(axis=1)],
    }


def build_validation_curve_data(
    model_id,
    X,
    y,
    cv,
    primary_metric,
    search_params,
    best_params,
    validation_param=None,
):
    active_search_space = resolve_matching_search_space(search_params, best_params)
    if not active_search_space:
        return None

    available_validation_params = get_available_validation_params(search_params, best_params)
    if not available_validation_params:
        return None

    param_name = validation_param
    if param_name not in available_validation_params:
        param_name = available_validation_params[0]

    param_spec = active_search_space.get(param_name)
    if param_spec is None:
        return None

    param_values = list(param_spec.validation_candidates())
    if not param_values:
        return None

    estimator = build_estimator(model_id)
    fixed_params = {key: value for key, value in best_params.items() if key != param_name}
    if fixed_params:
        estimator.set_params(**fixed_params)

    train_scores, validation_scores = validation_curve(
        estimator=estimator,
        X=X,
        y=y,
        param_name=param_name,
        param_range=param_values,
        cv=cv,
        scoring=primary_metric,
        n_jobs=None,
    )

    return {
        "metric": primary_metric,
        "param_name": param_name,
        "param_values": list(param_values),
        "train_scores_mean": [float(value) for value in train_scores.mean(axis=1)],
        "validation_scores_mean": [float(value) for value in validation_scores.mean(axis=1)],
        "train_scores_std": [float(value) for value in train_scores.std(axis=1)],
        "validation_scores_std": [float(value) for value in validation_scores.std(axis=1)],
    }


def build_actual_vs_predicted(best_estimator, X, y, cv):
    predictions = cross_val_predict(best_estimator, X, y, cv=cv, method="predict")
    actual = [float(value) for value in pd.Series(y).tolist()]
    predicted = [float(value) for value in predictions.tolist()]

    return sample_pairs(actual, predicted)


def collect_visual_diagnostics(
    *,
    best_estimator,
    X,
    y,
    cv,
    problem_type,
    model_id,
    primary_metric,
    search_params,
    best_params,
    random_state,
    include_validation_curve,
    validation_param,
):
    available_validation_params = get_available_validation_params(search_params, best_params)
    selected_validation_param = validation_param

    if selected_validation_param not in available_validation_params:
        selected_validation_param = (
            available_validation_params[0] if available_validation_params else None
        )

    diagnostics = {
        "available_validation_params": available_validation_params,
        "selected_validation_param": selected_validation_param,
        "confusion_matrix": None,
        "roc_curve": None,
        "learning_curve": build_learning_curve_data(
            best_estimator,
            X,
            y,
            cv,
            primary_metric,
            random_state,
        ),
        "validation_curve": None,
        "actual_vs_predicted": None,
    }

    if problem_type == "classification":
        diagnostics["confusion_matrix"] = build_confusion_matrix(best_estimator, X, y, cv)
        diagnostics["roc_curve"] = build_roc_curve(best_estimator, X, y, cv)
    else:
        diagnostics["actual_vs_predicted"] = build_actual_vs_predicted(best_estimator, X, y, cv)

    if include_validation_curve and selected_validation_param:
        diagnostics["validation_curve"] = build_validation_curve_data(
            model_id=model_id,
            X=X,
            y=y,
            cv=cv,
            primary_metric=primary_metric,
            search_params=search_params,
            best_params=best_params,
            validation_param=selected_validation_param,
        )

    return diagnostics


def build_model_diagnostics(
    dataset_path,
    target_column,
    problem_type,
    model_id,
    best_params,
    cv_folds=5,
    random_state=42,
    validation_param=None,
    optuna_payload=None,
    include_validation_curve=True,
):
    X, y = load_numeric_dataset(dataset_path, target_column, problem_type)
    cv, _ = build_cv(
        problem_type=problem_type,
        y=y,
        cv_folds=cv_folds,
        random_state=random_state,
    )

    model_config, primary_metric, scoring, search_params = prepare_model_context(
        problem_type, model_id
    )

    estimator = build_estimator(model_id)
    if best_params:
        estimator.set_params(**best_params)

    best_trial_payload = dict((optuna_payload or {}).get("best_trial") or {})
    cv_fold_scores = dict(best_trial_payload.get("cv_fold_scores") or {})

    if not cv_fold_scores:
        cv_result = cross_validate(
            estimator=estimator,
            X=X,
            y=y,
            cv=cv,
            scoring=scoring,
            return_train_score=False,
            n_jobs=None,
        )
        cv_fold_scores = {
            metric_name: [float(value) for value in cv_result[f"test_{metric_name}"]]
            for metric_name in scoring
        }

    diagnostics = collect_visual_diagnostics(
        best_estimator=estimator,
        X=X,
        y=y,
        cv=cv,
        problem_type=problem_type,
        model_id=model_id,
        primary_metric=primary_metric,
        search_params=search_params,
        best_params=best_params,
        random_state=random_state,
        include_validation_curve=include_validation_curve,
        validation_param=validation_param,
    )

    return {
        "model_id": model_config.id,
        "model_name": model_config.name,
        "category": model_config.category,
        "problem_type": model_config.problem_type,
        "primary_metric": primary_metric,
        "cv_fold_scores": cv_fold_scores,
        **diagnostics,
    }
