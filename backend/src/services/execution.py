"""Experiment execution orchestration."""

import threading
from queue import Empty

from loguru import logger

from src.db.database import SessionLocal
from src.db.models import Dataset, Experiment
from src.experiments.ranking.llm_ranker import apply_ockham_ranking
from src.ml.contracts import ModelSearchResult
from src.ml.ranking.ockham_evidence import build_ockham_evidence
from src.ml.score_ranker import rank_models_by_score
from src.services.diagnostics_backfill import backfill_ranked_diagnostics
from src.services.model_workers import start_model_process
from src.services.persistence import (
    format_error_message,
    is_cancel_requested,
    list_experiment_results,
    mark_experiment_cancelled,
    mark_experiment_failed,
    store_ranked_results,
)
from src.services.runtime import (
    SPAWN_CONTEXT,
    ActiveExperimentRun,
    cleanup_worker_process,
    close_active_run,
    register_active_run,
    stop_active_run_workers,
    terminate_worker_processes,
    unregister_active_run,
)


def should_cancel_experiment(session, experiment, active_run):
    """Check both in-memory and persisted cancellation signals."""
    if active_run.cancel_event.is_set():
        return True
    return is_cancel_requested(session, experiment)


def run_experiment_job(experiment_id):
    """Execute one experiment by fanning out model searches into worker processes.

    The parent process owns status updates, ranking, and persistence. Each child
    process only runs one model search and posts a result payload back to the
    parent queue.
    """
    session = SessionLocal()
    active_run = None

    try:
        experiment = session.get(Experiment, experiment_id)
        if experiment is None:
            return

        dataset = session.get(Dataset, experiment.dataset_id)
        if dataset is None:
            experiment.status = "failed"
            experiment.progress = 0
            session.commit()
            return

        selected_models = (
            [] if experiment.selected_models is None else list(experiment.selected_models)
        )
        if not selected_models:
            raise RuntimeError("Experiment has no selected models.")

        if experiment.status in {"cancel_requested", "cancelled"}:
            mark_experiment_cancelled(session, experiment_id)
            return

        experiment.status = "processing"
        experiment.progress = 3
        if experiment.training_state is None:
            experiment.training_state = []
        session.commit()

        total_models = len(selected_models)
        max_workers = min(4, total_models)
        pending_models = list(selected_models)
        in_flight = {}
        partial_results = []
        completed_models = set()
        failed_models = set()
        failure_messages = {}

        active_run = ActiveExperimentRun(
            experiment_id=experiment_id,
            result_queue=SPAWN_CONTEXT.Queue(),
        )
        register_active_run(experiment_id, active_run)

        def update_training_state(model_id, status, message=None):
            """Persist the per-model live status consumed by the frontend."""
            current_state = experiment.training_state or []
            next_state = []

            for item in current_state:
                if item["id"] != model_id:
                    next_state.append(item)
                    continue

                next_item = {**item, "status": status}
                if message is not None:
                    next_item["message"] = message
                next_state.append(next_item)

            experiment.training_state = next_state
            session.commit()

        def update_progress():
            completed_count = len(completed_models) + len(failed_models)
            progress = int(100 * completed_count / total_models)
            experiment.progress = min(95, max(5, progress))
            session.commit()

        def record_failed_model(model_id, message):
            failed_models.add(model_id)
            failure_messages[model_id] = message
            update_training_state(model_id, "failed", message)
            update_progress()

        while pending_models or in_flight:
            if should_cancel_experiment(session, experiment, active_run):
                terminate_worker_processes(active_run)
                mark_experiment_cancelled(session, experiment_id)
                return

            # Keep the worker pool full before waiting for the next payload.
            while pending_models and len(in_flight) < max_workers:
                model_id = pending_models.pop(0)
                update_training_state(model_id, "training")
                in_flight[model_id] = start_model_process(
                    active_run,
                    dataset.file_path,
                    experiment.target_column,
                    experiment.problem_type,
                    model_id,
                )

            try:
                payload = active_run.result_queue.get(timeout=0.35)
            except Empty:
                payload = None

            # A normal worker completion posts a payload back to the parent.
            if payload is not None:
                model_id = payload["model_id"]
                in_flight.pop(model_id, None)
                cleanup_worker_process(active_run, model_id)

                if payload["status"] == "done":
                    partial_results.append(ModelSearchResult.from_payload(payload["result"]))
                    completed_models.add(model_id)
                    update_training_state(model_id, "done")
                    update_progress()
                else:
                    error_message = payload.get("error")
                    if error_message is None:
                        error_message = "Model search failed."
                    record_failed_model(model_id, error_message)

            # A worker can also disappear without posting a payload.
            for model_id, process in list(in_flight.items()):
                try:
                    process_is_alive = process.is_alive()
                except Exception:
                    process_is_alive = False

                if process_is_alive:
                    continue

                cleanup_worker_process(active_run, model_id)
                in_flight.pop(model_id, None)

                if should_cancel_experiment(session, experiment, active_run):
                    continue
                if model_id in completed_models or model_id in failed_models:
                    continue

                record_failed_model(model_id, "Model search worker exited unexpectedly.")

        if is_cancel_requested(session, experiment):
            mark_experiment_cancelled(session, experiment_id)
            return

        if not partial_results:
            failure_message = next(iter(failure_messages.values()), "All selected models failed.")
            mark_experiment_failed(session, experiment_id, failure_message)
            return

        # Once every model is accounted for, ranking and persistence happen in
        # one place so the experiment record moves from processing to done only once.
        score_ranked_results = rank_models_by_score(partial_results)
        evidence_items = build_ockham_evidence(score_ranked_results)
        ranked_results = apply_ockham_ranking(evidence_items)

        if is_cancel_requested(session, experiment):
            mark_experiment_cancelled(session, experiment_id)
            return

        for record in list_experiment_results(session, experiment_id):
            session.delete(record)
        session.flush()

        store_ranked_results(session, experiment, ranked_results)
        experiment.status = "done"
        experiment.progress = 100
        session.commit()

        threading.Thread(
            target=backfill_ranked_diagnostics,
            args=(experiment_id,),
            daemon=True,
        ).start()
    except Exception as exc:
        logger.exception("Experiment {} failed", experiment_id)
        session.rollback()
        stop_active_run_workers(experiment_id)
        current = session.get(Experiment, experiment_id)
        if current is not None and current.status in {"cancel_requested", "cancelled"}:
            mark_experiment_cancelled(session, experiment_id)
        else:
            mark_experiment_failed(session, experiment_id, format_error_message(exc))
    finally:
        unregister_active_run(experiment_id)
        close_active_run(active_run)
        session.close()
