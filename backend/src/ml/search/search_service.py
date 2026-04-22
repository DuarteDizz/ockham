"""Model search orchestration kept separate from diagnostics helpers."""

from src.ml.contracts import ModelSearchResult
from src.ml.models.registry import build_estimator
from src.ml.search.cross_validation import build_cv
from src.ml.search.dataset_loader import load_numeric_dataset, prepare_model_context
from src.ml.search.diagnostics import collect_visual_diagnostics
from src.ml.search.feature_stats import (
    extract_feature_stats,
    measure_inference_time_per_1000_rows,
)
from src.ml.search.optuna_search import run_optuna_cv_search
from src.ml.search.search_space import effective_n_trials


def run_model_search(
    dataset_path,
    target_column,
    problem_type,
    selected_models,
    cv_folds=5,
    n_iter=10,
    random_state=42,
    include_diagnostics=True,
):
    """Run the Optuna search flow for each selected model."""
    if not selected_models:
        raise ValueError("selected_models cannot be empty.")

    X, y = load_numeric_dataset(dataset_path, target_column, problem_type)
    cv, cv_fold_count = build_cv(
        problem_type=problem_type,
        y=y,
        cv_folds=cv_folds,
        random_state=random_state,
    )

    results = []

    for model_id in selected_models:
        model_config, primary_metric, scoring, search_params = prepare_model_context(
            problem_type,
            model_id,
        )
        n_trials = effective_n_trials(search_params, n_iter)

        search_result = run_optuna_cv_search(
            estimator=build_estimator(model_id),
            search_params=search_params,
            X=X,
            y=y,
            cv=cv,
            primary_metric=primary_metric,
            scoring=scoring,
            n_trials=n_trials,
            random_state=random_state,
        )

        # Keep the Optuna payload local to this block so the final dataclass
        # build reads like a plain summary of one model search result.
        best_estimator = search_result["best_estimator"]
        best_params = search_result["best_params"]
        total_search_time = float(search_result["duration_seconds"])
        optuna_payload = dict(search_result["optuna"])
        best_trial = dict(optuna_payload["best_trial"])

        best_score = float(best_trial["value"])
        metrics_mean = dict(best_trial["metrics_mean"])
        metrics_std = dict(best_trial["metrics_std"])
        cv_fold_scores = dict(best_trial["cv_fold_scores"])
        fit_time_mean = float(best_trial["fit_time_mean"])
        score_time_mean = float(best_trial["score_time_mean"])

        optuna_payload["best_value"] = best_score
        optuna_payload["best_params"] = best_params
        optuna_payload["duration_seconds"] = total_search_time

        if include_diagnostics:
            diagnostics = collect_visual_diagnostics(
                best_estimator=best_estimator,
                X=X,
                y=y,
                cv=cv,
                problem_type=problem_type,
                model_id=model_id,
                primary_metric=primary_metric,
                search_params=search_params,
                best_params=best_params,
                random_state=random_state,
                include_validation_curve=True,
                validation_param=None,
            )
        else:
            diagnostics = {
                "confusion_matrix": None,
                "roc_curve": None,
                "learning_curve": None,
                "validation_curve": None,
                "actual_vs_predicted": None,
            }

        structural_scores = extract_feature_stats(best_estimator, X)
        structural_scores["simplicity_score"] = model_config.simplicity_score
        structural_scores["interpretability_score"] = model_config.interpretability_score
        structural_scores["scalability_score"] = model_config.scalability_score

        results.append(
            ModelSearchResult(
                model_id=model_config.id,
                model_name=model_config.name,
                category=model_config.category,
                problem_type=model_config.problem_type,
                primary_metric=primary_metric,
                best_score=best_score,
                best_params=best_params,
                metrics_mean=metrics_mean,
                metrics_std=metrics_std,
                fit_time_mean=fit_time_mean,
                score_time_mean=score_time_mean,
                total_search_time=total_search_time,
                inference_time_per_1000_rows=measure_inference_time_per_1000_rows(
                    best_estimator, X
                ),
                cv_folds=cv_fold_count,
                n_iter=n_trials,
                optuna=optuna_payload,
                structural_scores=structural_scores,
                cv_fold_scores=cv_fold_scores,
                confusion_matrix=diagnostics["confusion_matrix"],
                roc_curve=diagnostics["roc_curve"],
                learning_curve=diagnostics["learning_curve"],
                validation_curve=diagnostics["validation_curve"],
                actual_vs_predicted=diagnostics["actual_vs_predicted"],
            )
        )

    return results
