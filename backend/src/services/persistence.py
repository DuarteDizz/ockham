"""Persistence helpers shared across experiment execution routes."""

import uuid

from sqlalchemy import select

from src.db.models import Experiment, ExperimentResult


def format_error_message(exc):
    if exc is None:
        return "Experiment failed during execution."

    raw_message = (
        str(exc).strip() if isinstance(exc, str) else (str(exc).strip() or exc.__class__.__name__)
    )
    return " ".join(raw_message.split())[:240]


def list_experiment_results(session, experiment_id):
    return (
        session.execute(
            select(ExperimentResult).where(ExperimentResult.experiment_id == experiment_id)
        )
        .scalars()
        .all()
    )


def is_cancel_requested(session, experiment):
    if experiment is None:
        return False

    try:
        session.refresh(experiment)
    except Exception:
        session.rollback()
        return False

    return experiment.status == "cancel_requested"


def mark_experiment_cancelled(session, experiment_id):
    experiment = session.get(Experiment, experiment_id)
    if experiment is None:
        return

    for record in list_experiment_results(session, experiment_id):
        session.delete(record)

    session.delete(experiment)
    session.commit()


def mark_experiment_failed(session, experiment_id, message):
    experiment = session.get(Experiment, experiment_id)
    if experiment is None:
        return

    experiment.status = "failed"
    experiment.progress = 0

    training_state = experiment.training_state or []
    if training_state:
        experiment.training_state = [
            {**item, "status": "failed", "message": item.get("message") or message}
            if item.get("status") != "done"
            else item
            for item in training_state
        ]

    session.commit()


def store_ranked_results(session, experiment, ranked_results):
    records = [
        ExperimentResult(
            id=f"experiment_result_{uuid.uuid4().hex}",
            experiment_id=experiment.id,
            model_id=item["model_id"],
            model_name=item["model_name"],
            category=item["category"],
            problem_type=item["problem_type"],
            primary_metric=item["primary_metric"],
            best_score=item["best_score"],
            best_params=item["best_params"],
            metrics_mean=item["metrics_mean"],
            metrics_std=item["metrics_std"],
            structural_scores=item["structural_scores"],
            ockham_components=item["ockham_components"],
            fit_time_mean=item["fit_time_mean"],
            score_time_mean=item["score_time_mean"],
            total_search_time=item["total_search_time"],
            inference_time_per_1000_rows=item["inference_time_per_1000_rows"],
            performance_rank=item["performance_rank"],
            ockham_rank=item["ockham_rank"],
            is_ockham_recommended=item["is_ockham_recommended"],
            cv_fold_scores=item["cv_fold_scores"],
            confusion_matrix=item.get("confusion_matrix"),
            roc_curve=item.get("roc_curve"),
            learning_curve=item.get("learning_curve"),
            validation_curve=item.get("validation_curve"),
            actual_vs_predicted=item.get("actual_vs_predicted"),
            optuna_payload=item.get("optuna"),
        )
        for item in ranked_results
    ]

    session.add_all(records)


def normalize_validation_bundle(stored):
    if stored and stored.get("curves") is not None:
        return {
            "default_param": stored.get("default_param"),
            "curves": stored.get("curves") or {},
        }

    return {"default_param": None, "curves": {}}


def write_diagnostics_back_to_record(record, diagnostics, validation_bundle):
    record.cv_fold_scores = diagnostics.get("cv_fold_scores") or {}

    for field_name in (
        "confusion_matrix",
        "roc_curve",
        "learning_curve",
        "actual_vs_predicted",
    ):
        setattr(record, field_name, diagnostics.get(field_name) or None)

    record.validation_curve = {
        "default_param": validation_bundle.get("default_param"),
        "curves": validation_bundle.get("curves") or {},
    }
