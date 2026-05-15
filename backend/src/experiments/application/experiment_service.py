"""Application service for experiment validation and record creation."""

import uuid

from fastapi import HTTPException
from sqlalchemy import select

from src.api.dependencies import get_or_404
from src.db.models import Dataset, Experiment
from src.modeling.registry.model_specs import PROBLEM_TYPES
from src.modeling.registry.model_registry import get_model_config, get_models_by_problem_type


def build_training_state(selected_models):
    """Build the initial per-model training state shown in the UI."""
    training_state = []

    for model_id in selected_models:
        model = get_model_config(model_id)
        training_state.append(
            {
                "id": model_id,
                "name": model.name,
                "category": model.category,
                "status": "pending",
            }
        )

    return training_state


def validate_experiment_create_request(session, payload):
    """Validate a run request before any worker state is created."""
    if payload.problem_type not in PROBLEM_TYPES:
        raise HTTPException(400, "Invalid problem_type.")

    dataset = get_or_404(session, Dataset, payload.dataset_id, "Dataset not found.")

    active_experiment = session.execute(
        select(Experiment).where(
            Experiment.dataset_id == payload.dataset_id,
            Experiment.status.in_(["queued", "processing", "cancel_requested"]),
        )
    ).scalar_one_or_none()
    if active_experiment:
        raise HTTPException(
            409,
            (
                "There is already an active experiment for this dataset: "
                f"{active_experiment.id} (status={active_experiment.status})."
            ),
        )

    if not payload.selected_models:
        raise HTTPException(400, "selected_models cannot be empty.")

    if payload.target_column not in (dataset.column_names or []):
        raise HTTPException(400, "Target column not in dataset.")

    valid_model_ids = {model["id"] for model in get_models_by_problem_type(payload.problem_type)}
    invalid_model_ids = [
        model_id for model_id in payload.selected_models if model_id not in valid_model_ids
    ]
    if invalid_model_ids:
        raise HTTPException(
            400,
            (f"Invalid models for problem_type '{payload.problem_type}': {invalid_model_ids}"),
        )

    return dataset


def create_experiment_record(session, payload, training_state):
    """Persist a queued experiment record and return the refreshed ORM entity."""
    experiment = Experiment(
        id=f"experiment_{uuid.uuid4().hex}",
        dataset_id=payload.dataset_id,
        problem_type=payload.problem_type,
        target_column=payload.target_column,
        selected_models=payload.selected_models,
        status="queued",
        progress=0,
        training_state=training_state,
    )

    session.add(experiment)
    session.commit()
    session.refresh(experiment)

    return experiment
