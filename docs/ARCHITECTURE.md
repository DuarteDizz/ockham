# Architecture Overview

## System intent

Ockham is built as a full-stack experimentation product for tabular machine learning.

The architecture is intentionally opinionated around one goal: make model comparison readable as a product workflow, not just as a collection of training scripts. The repository separates HTTP delivery, experiment orchestration, classical ML execution, LLM-assisted ranking, persistence, and UI state so each concern remains visible in the codebase.

## High-level layout

```text
frontend/  -> React interface for dataset upload, experiment setup, live training, and ranking views
backend/   -> FastAPI API, Optuna-backed execution, ranking, diagnostics, and persistence
examples/  -> sample CSV datasets for local demo runs
scripts/   -> lightweight local validation and smoke-test helpers
docs/      -> active project documentation aligned to the current codebase
```

## End-to-end flow

A typical run moves through these stages:

1. The frontend uploads a CSV dataset to the backend.
2. The backend stores the file under `backend/storage/datasets/` and registers dataset metadata in SQLite.
3. The user chooses the target column, problem type, and candidate models.
4. The backend creates an experiment record and starts background execution.
5. The ML layer performs Optuna-backed search, cross-validation, scoring, and evidence assembly for each candidate model.
6. The backend persists ranked results and exposes live experiment state to the frontend.
7. The frontend polls the experiment endpoint until the dashboard is ready.
8. Diagnostics are loaded from persisted artifacts when available and rebuilt lazily when the detail view needs missing charts.
9. If LLM ranking is enabled, the LLM layer receives a compact evidence payload and returns a structured recommendation used by the Ockham ranking flow.

## Frontend responsibilities

The frontend is organized by product feature so the application map is easy to follow.

### `frontend/src/app/`
Application shell, route composition, and top-level workflow entrypoints.

### `frontend/src/features/datasets/`
Dataset upload, dataset listing, and dataset detail pages.

### `frontend/src/features/experiments/`
Experiment setup, model selection, live training state, and experiment dashboard entrypoints.

### `frontend/src/features/ranking/`
Leaderboard views, diagnostics cards, comparison components, and ranking-heavy presentation logic.

### `frontend/src/features/workspace/`
Shared workspace state, polling behavior, and orchestration helpers reused across the main product flow.

### `frontend/src/shared/`
Shared API clients, reusable UI components, layout primitives, and common frontend utilities.

## Backend responsibilities

The backend uses a `backend/src/` package layout that keeps the training engine explicit while isolating the LLM path from the core ML flow.

### `backend/src/api/`
FastAPI routes, request and response schemas, presenters, and dependency helpers.

- `routes/` defines the public HTTP surface
- `schemas/` defines response and request models
- `presenters/` keeps API serialization logic out of the service layer

### `backend/src/services/`
Experiment-oriented orchestration services.

- `experiments.py` validates requests and creates experiment records
- `execution.py` coordinates the full run lifecycle, ranking, and persistence
- `runtime.py` manages active workers and cancellation hooks
- `persistence.py` centralizes result reads and writes used by the API and execution flow
- `diagnostics_backfill.py` supports rebuilding missing detail artifacts when needed

### `backend/src/ml/`
Classical machine learning execution and ranking logic.

Responsibilities include:

- model registry and model specs
- search-space definition
- Optuna-backed search execution
- dataset loading and cross-validation helpers
- diagnostics generation
- score-based ranking
- Ockham evidence assembly from measured model outputs

This layer is the technical core of the product. It is intentionally separate from HTTP code and from the LLM path.

### `backend/src/llm/`
LLM-specific ranking integration.

Responsibilities include:

- compact evidence payload construction
- prompt assembly
- LangChain + Ollama client integration
- structured output parsing and validation
- final LLM-driven recommendation for the Ockham ranking mode

The LLM layer does not train models and does not inspect raw datasets directly. It operates on the prepared evidence bundle assembled from the experiment outputs.

### `backend/src/db/`
SQLite engine setup and ORM models.

This layer persists:

- dataset records
- experiment records
- experiment result rows
- diagnostics artifacts and ranking outputs

### `backend/src/config/`
Centralized runtime configuration, logging, and project paths.

`settings.py` resolves the repository root, backend runtime folders, API host/port, and LLM configuration from the shared root `.env` file.

## Persistence boundaries

Ockham uses two local persistence styles on purpose.

### `backend/data/`
Structured local persistence.

- `ockham.db` stores datasets, experiments, results, and related runtime metadata

### `backend/storage/`
Filesystem-backed runtime artifacts.

- `datasets/` stores uploaded CSV files
- `logs/` stores backend log files when file logging is enabled

This split keeps the difference between structured application state and mutable runtime files obvious.

## Ranking architecture

Ockham exposes two ranking perspectives for the same experiment.

### Score ranking
A metric-first ordering based on the primary evaluation metric and standard CV outputs.

### Ockham ranking
A broader evidence-based ordering that combines predictive evidence with execution, structural, and operational signals. When enabled, the LLM layer receives that evidence as a structured payload and returns a recommendation that is then validated and surfaced back to the UI.

That separation is central to the product story: the backend can answer both “what scored highest?” and “what looks like the most defensible overall choice?”

## Diagnostics strategy

The dashboard is designed so ranking comes first and expensive detail generation can remain secondary.

- summary results are persisted during the experiment flow
- embedded diagnostics are returned with ranked results when already available
- detail artifacts such as validation curves are rebuilt lazily through the diagnostics endpoint when required

This keeps the initial dashboard path focused on experiment completion without blocking on every possible chart artifact up front.

## Why this structure matters

The repository is meant to read like a product, not like a loose lab notebook.

This structure makes it clear that:

- the frontend expresses a guided experimentation workflow
- the API surface stays small and user-facing
- the ML engine is a dedicated subsystem, not scattered across route handlers
- the LLM path is isolated and optional rather than mixed into the training core
- local operability remains simple from the repository root

## Related documents

- [`SETUP.md`](SETUP.md)
- [`DOCKER.md`](DOCKER.md)
- [`API.md`](API.md)
