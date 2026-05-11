"""Experiment presenters: serialize experiment records and live status."""

from src.db.models import Experiment, ExperimentResult


def summarize_live_step(record: Experiment, training_state=None):
    state = training_state if training_state is not None else (record.training_state or [])
    status = record.status

    if status == "queued":
        return "queue", "Preparing experiment and waiting to start workers."

    if status == "cancel_requested":
        return (
            "cancelling",
            "Cancellation requested. Stopping active workers and waiting for confirmation.",
        )

    if status == "cancelled":
        return "cancelled", "Experiment cancelled by the user before the dashboard was prepared."

    if status == "failed":
        failure_message = next(
            (item.get("message") for item in state if item.get("message")),
            None,
        )
        return (
            "failed",
            failure_message or "Experiment failed before the results dashboard could be prepared.",
        )

    if status == "done":
        failed_count = sum(1 for item in state if item.get("status") == "failed")
        if failed_count:
            plural = "s" if failed_count != 1 else ""
            return (
                "completed",
                (
                    "Training finished with partial results. "
                    f"{failed_count} model{plural} failed and were skipped."
                ),
            )

        return "completed", "Training finished. Loading ranked results and diagnostics."

    active_models = [
        item.get("name") or item.get("id") for item in state if item.get("status") == "training"
    ]
    completed_count = sum(1 for item in state if item.get("status") == "done")
    total_count = len(state)

    if active_models:
        if len(active_models) == 1:
            return "optuna_search", f"Optuna is tuning {active_models[0]}."

        preview = ", ".join(active_models[:2])
        suffix = "" if len(active_models) <= 2 else f" and {len(active_models) - 2} more"
        return "optuna_search", f"Optuna is tuning {preview}{suffix}."

    if total_count and completed_count >= total_count:
        if record.progress >= 97:
            return "finalizing", "Finalizing experiment payload for the dashboard."

        return "ranking", "Ranking models and consolidating the benchmark results."

    if completed_count > 0:
        remaining = max(total_count - completed_count, 0)
        plural = "s" if remaining != 1 else ""
        return (
            "scheduling",
            f"Scheduling the next model runs. {remaining} model{plural} remaining.",
        )

    return "preparing", "Preparing cross-validation folds and training workers."


def experiment_payload(record: Experiment) -> dict[str, object]:
    training_state = record.training_state
    live_step, live_message = summarize_live_step(record, training_state)

    return {
        "experiment_id": record.id,
        "dataset_id": record.dataset_id,
        "problem_type": record.problem_type,
        "target_column": record.target_column,
        "selected_models": record.selected_models or [],
        "status": record.status,
        "progress": record.progress,
        "training_state": training_state,
        "live_step": live_step,
        "live_message": live_message,
        "started_at": record.created_at.isoformat() if record.created_at else None,
    }


def experiment_summary_payload(
    record: Experiment,
    result_records: list[ExperimentResult],
) -> dict[str, object]:
    recommended = next((r for r in result_records if r.is_ockham_recommended), None)
    score_winner = next((r for r in result_records if r.performance_rank == 1), None)

    first = recommended or score_winner or (result_records[0] if result_records else None)
    primary_metric = first.primary_metric if first else None
    models = [r.model_name for r in result_records] or (record.selected_models or [])

    return {
        "id": record.id,
        "run_at": record.created_at.isoformat() if record.created_at else None,
        "problem_type": record.problem_type,
        "target_column": record.target_column,
        "status": record.status,
        "progress": record.progress,
        "selected_models": record.selected_models or [],
        "models": models,
        "best_model_by_ockham": recommended.model_name if recommended else None,
        "best_score_by_ockham": recommended.best_score if recommended else None,
        "best_model_by_score": score_winner.model_name if score_winner else None,
        "best_score_by_score": score_winner.best_score if score_winner else None,
        "primary_metric": primary_metric,
        "ranking_mode": "ockham",
    }
