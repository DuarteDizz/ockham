"""Experiments endpoint: create, run, inspect, and clean up Ockham benchmarks."""

import threading
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies import get_or_404, get_session
from src.api.presenters.experiment_presenter import (
    experiment_payload,
    experiment_summary_payload,
)
from src.api.presenters.result_presenter import (
    attach_capability_profiles,
    diagnostics_payload,
    result_payload_with_embedded,
)
from src.api.schemas.experiment import ExperimentCreateRequest, ExperimentResponse
from src.api.schemas.result import (
    ExperimentModelDiagnosticsResponse,
    ExperimentResultsResponse,
)
from src.db.models import Dataset, Experiment, ExperimentResult
from src.ml.models.registry import get_model_config
from src.ml.search.diagnostics import build_model_diagnostics
from src.ml.search.search_space import get_available_validation_params
from src.services.execution import run_experiment_job
from src.services.experiments import (
    build_training_state,
    create_experiment_record,
    validate_experiment_create_request,
)
from src.services.persistence import (
    list_experiment_results,
    normalize_validation_bundle,
    write_diagnostics_back_to_record,
)
from src.services.runtime import stop_active_run_workers

router = APIRouter(prefix="/experiments", tags=["experiments"])
DB = Annotated[Session, Depends(get_session)]


@router.post("/run", response_model=ExperimentResponse)
def run_experiment(payload: ExperimentCreateRequest, session: DB):
    """Create one experiment record and start the background execution thread."""
    validate_experiment_create_request(session, payload)

    experiment = create_experiment_record(
        session=session,
        payload=payload,
        training_state=build_training_state(payload.selected_models),
    )

    threading.Thread(target=run_experiment_job, args=(experiment.id,), daemon=True).start()
    return experiment_payload(experiment)


@router.get("/by-dataset/{dataset_id}")
def get_experiments_by_dataset(dataset_id: str, session: DB):
    """List finished experiments for one dataset."""
    get_or_404(session, Dataset, dataset_id, "Dataset not found.")

    experiment_records = (
        session.execute(
            select(Experiment).where(
                Experiment.dataset_id == dataset_id,
                Experiment.status.in_(["done", "failed"]),
            )
        )
        .scalars()
        .all()
    )

    experiments = []
    for experiment_record in experiment_records:
        result_records = list_experiment_results(session, experiment_record.id)
        experiments.append(experiment_summary_payload(experiment_record, result_records))

    experiments.sort(
        key=lambda item: item["run_at"] if item["run_at"] is not None else "",
        reverse=True,
    )
    return {"dataset_id": dataset_id, "experiments": experiments}


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: str, session: DB):
    experiment = get_or_404(session, Experiment, experiment_id, "Experiment not found.")
    return experiment_payload(experiment)


@router.post("/{experiment_id}/abort", response_model=ExperimentResponse)
def abort_experiment(experiment_id: str, session: DB):
    """Request cancellation for a running experiment."""
    experiment = get_or_404(session, Experiment, experiment_id, "Experiment not found.")
    if experiment.status == "cancelled":
        return experiment_payload(experiment)
    if experiment.status in {"done", "failed"}:
        raise HTTPException(409, "Experiment can no longer be cancelled.")

    current_training_state = [] if experiment.training_state is None else experiment.training_state
    next_training_state = []

    for item in current_training_state:
        next_item = dict(item)
        if item["status"] in {"pending", "training"}:
            next_item["status"] = "cancelled"
            next_item["message"] = "Experiment cancelled by the user."
        next_training_state.append(next_item)

    experiment.status = "cancel_requested"
    experiment.training_state = next_training_state
    session.commit()

    stop_active_run_workers(experiment_id)
    session.refresh(experiment)
    return experiment_payload(experiment)


@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: str, session: DB):
    experiment = get_or_404(session, Experiment, experiment_id, "Experiment not found.")

    for result_record in list_experiment_results(session, experiment_id):
        session.delete(result_record)

    session.delete(experiment)
    session.commit()
    return {"ok": True, "experiment_id": experiment_id}


@router.get("/{experiment_id}/results", response_model=ExperimentResultsResponse)
def get_experiment_results(experiment_id: str, session: DB, ranking_mode: str = "ockham"):
    """Return serialized ranked results for one experiment."""
    if ranking_mode not in {"ockham", "score"}:
        raise HTTPException(400, "Invalid ranking_mode.")

    get_or_404(session, Experiment, experiment_id, "Experiment not found.")

    result_payloads = []
    for record in list_experiment_results(session, experiment_id):
        result_payloads.append(result_payload_with_embedded(record))

    results = attach_capability_profiles(result_payloads)
    rank_key = "ockham_rank" if ranking_mode == "ockham" else "performance_rank"
    results.sort(key=lambda item: item[rank_key])

    ranking_provider = None
    ranking_status = None
    ranking_error = None
    if ranking_mode == "ockham" and results:
        first_components = results[0].get("ockham_components") or {}
        ranking_provider = first_components.get("ranking_provider")
        ranking_status = first_components.get("ranking_status")
        ranking_error = first_components.get("ranking_error")

    return {
        "experiment_id": experiment_id,
        "ranking_mode": ranking_mode,
        "ranking_provider": ranking_provider,
        "ranking_status": ranking_status,
        "ranking_error": ranking_error,
        "results": results,
    }


@router.get(
    "/{experiment_id}/models/{model_id}/diagnostics",
    response_model=ExperimentModelDiagnosticsResponse,
)
def get_model_diagnostics(
    experiment_id: str,
    model_id: str,
    session: DB,
    validation_param: str | None = None,
    scope: str = "full",
):
    """Return diagnostics for one model and rebuild missing artifacts when needed."""
    result_record = session.execute(
        select(ExperimentResult).where(
            ExperimentResult.experiment_id == experiment_id,
            ExperimentResult.model_id == model_id,
        )
    ).scalar_one_or_none()
    if result_record is None:
        raise HTTPException(404, "Model diagnostics not found.")

    diagnostics_scope = scope.lower()
    if diagnostics_scope not in {"full", "minimal"}:
        raise HTTPException(400, "Invalid diagnostics scope.")

    experiment = session.get(Experiment, experiment_id)
    dataset = None if experiment is None else session.get(Dataset, experiment.dataset_id)

    best_params = {} if result_record.best_params is None else result_record.best_params

    validation_bundle = normalize_validation_bundle(result_record.validation_curve)
    validation_curves = validation_bundle["curves"]
    default_validation_param = validation_bundle["default_param"]

    search_params = get_model_config(model_id).get_search_params()
    available_validation_params = get_available_validation_params(search_params, best_params)

    selected_validation_param = validation_param
    if selected_validation_param not in available_validation_params:
        selected_validation_param = default_validation_param
    if selected_validation_param not in available_validation_params and available_validation_params:
        selected_validation_param = available_validation_params[0]

    validation_curve = None
    if selected_validation_param is not None:
        validation_curve = validation_curves.get(selected_validation_param)

    cv_fold_scores = {} if result_record.cv_fold_scores is None else result_record.cv_fold_scores
    diagnostics = {
        "cv_fold_scores": cv_fold_scores,
        "confusion_matrix": result_record.confusion_matrix,
        "roc_curve": result_record.roc_curve,
        "learning_curve": result_record.learning_curve,
        "validation_curve": validation_curve,
        "actual_vs_predicted": result_record.actual_vs_predicted,
        "available_validation_params": available_validation_params,
        "selected_validation_param": selected_validation_param,
    }

    needs_rebuild = False
    if experiment is not None and dataset is not None:
        if diagnostics["learning_curve"] is None:
            needs_rebuild = True
        if (
            result_record.problem_type == "classification"
            and diagnostics["confusion_matrix"] is None
        ):
            needs_rebuild = True
        if result_record.problem_type == "classification" and diagnostics["roc_curve"] is None:
            needs_rebuild = True
        if (
            result_record.problem_type == "regression"
            and diagnostics["actual_vs_predicted"] is None
        ):
            needs_rebuild = True
        if (
            diagnostics_scope == "full"
            and selected_validation_param is not None
            and diagnostics["validation_curve"] is None
        ):
            needs_rebuild = True

    # Diagnostics are persisted lazily so the initial experiment flow stays focused
    # on ranking. When a detail view needs a missing artifact, rebuild and save it here.
    if needs_rebuild:
        rebuilt = build_model_diagnostics(
            dataset_path=dataset.file_path,
            target_column=experiment.target_column,
            problem_type=experiment.problem_type,
            model_id=model_id,
            best_params=best_params,
            cv_folds=5,
            validation_param=selected_validation_param if diagnostics_scope == "full" else None,
            optuna_payload=result_record.optuna_payload,
            include_validation_curve=(diagnostics_scope == "full"),
        )

        rebuilt_keys = (
            "cv_fold_scores",
            "confusion_matrix",
            "roc_curve",
            "learning_curve",
            "actual_vs_predicted",
            "available_validation_params",
            "selected_validation_param",
            "validation_curve",
        )
        for key in rebuilt_keys:
            value = rebuilt.get(key)
            if value is not None:
                diagnostics[key] = value

        current_validation_param = diagnostics["selected_validation_param"]
        if diagnostics["validation_curve"] is not None and current_validation_param is not None:
            validation_curves[current_validation_param] = diagnostics["validation_curve"]
            if validation_bundle["default_param"] is None:
                validation_bundle["default_param"] = current_validation_param

        write_diagnostics_back_to_record(result_record, diagnostics, validation_bundle)
        session.commit()

    result_payloads = []
    for record in list_experiment_results(session, experiment_id):
        result_payloads.append(result_payload_with_embedded(record))

    capability_profile = None
    for item in attach_capability_profiles(result_payloads):
        if item["model_id"] == model_id:
            capability_profile = item["capability_profile"]
            break

    diagnostics["capability_profile"] = capability_profile
    return diagnostics_payload(result_record, diagnostics)
