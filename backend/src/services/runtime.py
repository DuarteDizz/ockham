"""Runtime state for active experiment workers."""

import multiprocessing as mp
import threading
from dataclasses import dataclass, field

SPAWN_CONTEXT = mp.get_context("spawn")
ACTIVE_RUNS_LOCK = threading.Lock()
ACTIVE_RUNS = {}


@dataclass
class ActiveExperimentRun:
    """Track the live worker set for one experiment while it is processing."""

    experiment_id: str
    cancel_event: threading.Event = field(default_factory=threading.Event)
    result_queue: object | None = None
    worker_processes: dict[str, object] = field(default_factory=dict)


def register_active_run(experiment_id, active_run):
    """Expose a live run so the API layer can cancel it later."""
    with ACTIVE_RUNS_LOCK:
        ACTIVE_RUNS[experiment_id] = active_run


def unregister_active_run(experiment_id):
    """Drop a run from the live registry once processing finishes."""
    with ACTIVE_RUNS_LOCK:
        ACTIVE_RUNS.pop(experiment_id, None)


def get_active_run(experiment_id):
    """Return the in-memory runtime handle for an active experiment."""
    with ACTIVE_RUNS_LOCK:
        return ACTIVE_RUNS.get(experiment_id)


def cleanup_worker_process(active_run, model_id):
    """Join and close one finished worker without leaking cleanup errors."""
    process = active_run.worker_processes.pop(model_id, None)
    if process is None:
        return

    try:
        process.join(timeout=0.2)
    except Exception:
        pass

    try:
        process.close()
    except Exception:
        pass


def terminate_worker_processes(active_run):
    """Stop every worker tracked under an active run.

    We terminate first and then reuse the regular cleanup path so the code
    keeps one exit routine for both normal completion and cancellation.
    """
    for process in list(active_run.worker_processes.values()):
        if process is None:
            continue

        try:
            if process.is_alive():
                process.terminate()
        except Exception:
            continue

    for model_id in list(active_run.worker_processes):
        cleanup_worker_process(active_run, model_id)


def close_active_run(active_run):
    """Release all process and queue resources associated with a run."""
    if active_run is None:
        return

    terminate_worker_processes(active_run)

    if active_run.result_queue is not None:
        try:
            active_run.result_queue.close()
        except Exception:
            pass

        try:
            active_run.result_queue.join_thread()
        except Exception:
            pass


def stop_active_run_workers(experiment_id):
    """Signal cancellation and stop all workers for a live experiment."""
    active_run = get_active_run(experiment_id)
    if active_run is None:
        return False

    active_run.cancel_event.set()
    terminate_worker_processes(active_run)
    return True
