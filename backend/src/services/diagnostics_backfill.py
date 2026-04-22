"""Background diagnostics enrichment for the top ranked models."""

from loguru import logger
from sqlalchemy import select

from src.db.database import SessionLocal
from src.db.models import Dataset, Experiment, ExperimentResult
from src.ml.search.diagnostics import build_model_diagnostics
from src.services.persistence import write_diagnostics_back_to_record


def backfill_ranked_diagnostics(experiment_id, top_n=3):
    session = SessionLocal()

    try:
        experiment = session.get(Experiment, experiment_id)
        if experiment is None or experiment.status != "done":
            return

        dataset = session.get(Dataset, experiment.dataset_id)
        if dataset is None:
            return

        result_records = (
            session.execute(
                select(ExperimentResult)
                .where(ExperimentResult.experiment_id == experiment_id)
                .order_by(
                    ExperimentResult.ockham_rank.asc(),
                    ExperimentResult.performance_rank.asc(),
                )
            )
            .scalars()
            .all()
        )

        for record in result_records[: max(1, top_n)]:
            diagnostics = build_model_diagnostics(
                dataset_path=dataset.file_path,
                target_column=experiment.target_column,
                problem_type=experiment.problem_type,
                model_id=record.model_id,
                best_params=record.best_params or {},
                cv_folds=5,
                optuna_payload=record.optuna_payload,
            )

            validation_bundle = {"default_param": None, "curves": {}}
            if diagnostics.get("validation_curve") and diagnostics.get("selected_validation_param"):
                selected_param = diagnostics["selected_validation_param"]
                validation_bundle = {
                    "default_param": selected_param,
                    "curves": {selected_param: diagnostics["validation_curve"]},
                }

            write_diagnostics_back_to_record(record, diagnostics, validation_bundle)
            session.commit()
    except Exception:
        logger.exception("Failed to backfill diagnostics for experiment {}", experiment_id)
        session.rollback()
    finally:
        session.close()
