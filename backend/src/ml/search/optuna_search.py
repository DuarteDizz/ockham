"""Optuna cross-validation search used by the model search service."""

import time

import numpy as np
import optuna
from sklearn.base import clone
from sklearn.model_selection import cross_validate

from src.ml.models.model_specs import serialize_search_params
from src.ml.search.search_space import iter_search_spaces


def summarize_cv_result(cv_result, scoring):
    """Collect fold-level scores and timing from one CV run."""
    cv_fold_scores = {}
    metrics_mean = {}
    metrics_std = {}

    for metric_name in scoring:
        scores = [float(value) for value in cv_result[f"test_{metric_name}"]]
        cv_fold_scores[metric_name] = scores
        metrics_mean[metric_name] = float(np.mean(scores))
        metrics_std[metric_name] = float(np.std(scores))

    return {
        "cv_fold_scores": cv_fold_scores,
        "metrics_mean": metrics_mean,
        "metrics_std": metrics_std,
        "fit_time_mean": float(np.mean(cv_result["fit_time"])),
        "score_time_mean": float(np.mean(cv_result["score_time"])),
    }


def run_optuna_cv_search(
    *,
    estimator,
    search_params,
    X,
    y,
    cv,
    primary_metric,
    scoring,
    n_trials,
    random_state=42,
):
    """Run one Optuna study and return the fitted best estimator plus metadata."""
    spaces = iter_search_spaces(search_params)
    if not spaces:
        raise ValueError("The model search space is empty.")

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=random_state),
    )

    def objective(trial):
        search_space_index = 0
        search_space = spaces[0]

        # Some models expose alternative parameter spaces. The chosen index is
        # stored on the trial so the final payload can explain what Optuna used.
        if len(spaces) > 1:
            search_space_index = int(
                trial.suggest_categorical("__space_index", list(range(len(spaces))))
            )
            search_space = spaces[search_space_index]

        resolved_params = {}
        for param_name, param_spec in search_space.items():
            resolved_params[param_name] = param_spec.suggest(trial, param_name)

        model = clone(estimator)
        if resolved_params:
            model.set_params(**resolved_params)

        cv_result = cross_validate(
            estimator=model,
            X=X,
            y=y,
            cv=cv,
            scoring=scoring,
            return_train_score=False,
            n_jobs=None,
            error_score="raise",
        )

        trial_summary = summarize_cv_result(cv_result, scoring)
        objective_value = float(trial_summary["metrics_mean"][primary_metric])
        if np.isnan(objective_value):
            raise ValueError(f"Primary metric '{primary_metric}' returned NaN during Optuna CV.")

        trial.set_user_attr("resolved_params", resolved_params)
        trial.set_user_attr("trial_summary", trial_summary)
        trial.set_user_attr("search_space_index", search_space_index)
        return objective_value

    started_at = time.perf_counter()
    study.optimize(objective, n_trials=max(1, n_trials), catch=(Exception,))
    duration_seconds = float(time.perf_counter() - started_at)

    completed_trials = [
        trial for trial in study.trials if trial.state == optuna.trial.TrialState.COMPLETE
    ]
    if not completed_trials:
        failed_trials = [
            trial for trial in study.trials if trial.state == optuna.trial.TrialState.FAIL
        ]

        fail_messages = []
        for trial in failed_trials[-3:]:
            fail_reason = trial.system_attrs.get("fail_reason")
            message = "" if fail_reason is None else str(fail_reason).strip()
            if message:
                fail_messages.append(f"trial {trial.number}: {message}")

        details = ""
        if fail_messages:
            details = f" Details: {'; '.join(fail_messages)}"
        raise RuntimeError(f"Optuna failed to complete a valid trial for this model.{details}")

    best_trial = study.best_trial
    best_params = best_trial.user_attrs.get("resolved_params")
    if best_params is None:
        best_params = {}
    else:
        best_params = dict(best_params)

    best_summary = best_trial.user_attrs.get("trial_summary")
    if best_summary is None:
        best_summary = {}
    else:
        best_summary = dict(best_summary)

    best_score = best_trial.value
    if best_score is None:
        metrics_mean = best_summary.get("metrics_mean")
        if metrics_mean is None:
            metrics_mean = {}
        best_score = float(metrics_mean.get(primary_metric, 0.0))
    else:
        best_score = float(best_score)

    best_estimator = clone(estimator)
    if best_params:
        best_estimator.set_params(**best_params)
    best_estimator.fit(X, y)

    # Trial history gives the dashboard enough detail to explain what the study
    # tried without persisting the full Optuna study object.
    trial_history = []
    for trial in study.trials:
        resolved_params = trial.user_attrs.get("resolved_params")
        if resolved_params is None:
            params = dict(trial.params)
        else:
            params = dict(resolved_params)

        value = None if trial.value is None else float(trial.value)
        trial_history.append(
            {
                "number": int(trial.number),
                "state": str(trial.state.name).lower(),
                "value": value,
                "params": params,
                "selected_search_space_index": trial.user_attrs.get("search_space_index"),
            }
        )

    best_trial_payload = {
        "number": int(best_trial.number),
        "value": best_score,
        "params": best_params,
        "selected_search_space_index": best_trial.user_attrs.get("search_space_index"),
    }
    best_trial_payload.update(best_summary)

    optuna_payload = {
        "search_backend": "optuna_cv",
        "best_value": best_score,
        "best_params": best_params,
        "duration_seconds": duration_seconds,
        "n_trials": len(study.trials),
        "search_space": serialize_search_params(search_params),
        "best_trial": best_trial_payload,
        "trial_history": trial_history,
    }

    return {
        "best_estimator": best_estimator,
        "best_params": best_params,
        "best_score": best_score,
        "duration_seconds": duration_seconds,
        "optuna": optuna_payload,
    }
