"""Worker-process helpers for per-model experiment execution."""

from src.ml.search.search_service import run_model_search
from src.services.persistence import format_error_message
from src.services.runtime import SPAWN_CONTEXT


def run_single_model(dataset_path, target_column, problem_type, model_id):
    return run_model_search(
        dataset_path=dataset_path,
        target_column=target_column,
        problem_type=problem_type,
        selected_models=[model_id],
        cv_folds=5,
        n_iter=10,
        include_diagnostics=False,
    )[0]


def run_single_model_worker(result_queue, dataset_path, target_column, problem_type, model_id):
    try:
        result = run_single_model(dataset_path, target_column, problem_type, model_id)
        result_queue.put(
            {
                "model_id": model_id,
                "status": "done",
                "result": result.to_dict(),
            }
        )
    except Exception as exc:
        result_queue.put(
            {
                "model_id": model_id,
                "status": "failed",
                "error": format_error_message(exc),
            }
        )


def start_model_process(active_run, dataset_path, target_column, problem_type, model_id):
    process = SPAWN_CONTEXT.Process(
        target=run_single_model_worker,
        args=(
            active_run.result_queue,
            dataset_path,
            target_column,
            problem_type,
            model_id,
        ),
        daemon=True,
        name=f"ockham-model-{model_id}",
    )
    process.start()
    active_run.worker_processes[model_id] = process
    return process
