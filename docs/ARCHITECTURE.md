# Architecture Overview

## System intent

Ockham is built as a full-stack experimentation product for tabular machine learning.

The backend is organized by responsibility rather than by implementation technology. Dataset handling, agentic preprocessing, model search, experiment orchestration, AI provider access, persistence, and HTTP delivery each live in their own module boundary.

## High-level layout

```text
frontend/  -> React interface for dataset upload, preprocessing, experiment setup, live training, and ranking views
backend/   -> FastAPI API, agentic preprocessing, Optuna-backed model search, experiment orchestration, ranking, diagnostics, and persistence
examples/  -> sample CSV datasets for local demo runs
scripts/   -> lightweight local validation and smoke-test helpers
docs/      -> project documentation aligned to the current codebase
```

## End-to-end flow

A typical run moves through these stages:

1. The frontend uploads a CSV dataset to the backend.
2. The backend stores the file under the configured runtime storage path and registers dataset metadata in SQLite.
3. The preprocessing module profiles the dataset deterministically and can build an agentic preprocessing plan.
4. The user chooses the target column, problem type, and candidate models.
5. The backend creates an experiment record and starts background execution.
6. The modeling module performs Optuna-backed search, cross-validation, scoring, and diagnostics for each candidate model.
7. The experiments module persists ranked results and exposes live experiment state to the frontend.
8. The frontend polls the experiment endpoint until the dashboard is ready.
9. Diagnostics are loaded from persisted artifacts when available and rebuilt lazily when the detail view needs missing charts.
10. If AI ranking is enabled, the experiments ranking module uses the AI provider layer to rank candidates from compact structured evidence.

## Frontend responsibilities

The frontend is organized by product feature so the application map is easy to follow.

### `frontend/src/app/`
Application shell, route composition, and top-level workflow entrypoints.

### `frontend/src/features/datasets/`
Dataset upload, dataset listing, and dataset detail pages.

### `frontend/src/features/preprocessing/`
Dataset profiling, agentic preprocessing run state, operation registry consumption, and preprocessing-plan editing UI. Presentation components live under `components/`, while plan normalization, operation metadata, and column-profile helpers live under `lib/`.

### `frontend/src/features/experiments/`
Experiment setup, model selection, live training state, experiment dashboard entrypoints, and ranking-heavy presentation logic. Ranking components are nested under `features/experiments/ranking/` because they are only meaningful inside an experiment result context.

### `frontend/src/features/workspace/`
Shared workspace state and orchestration hooks. Pure helper functions live under `workspace/lib/`; React state composition remains under `workspace/state/`.

### `frontend/src/shared/`
Shared API clients, reusable UI components, layout primitives, and common frontend utilities.

## Backend responsibilities

The backend uses a `backend/src/` package layout organized around product responsibilities.

### `backend/src/api/`
FastAPI routes, request and response schemas, presenters, and dependency helpers.

- `routes/` defines the public HTTP surface.
- `schemas/` defines response and request models.
- `presenters/` keeps API serialization logic out of application services.

### `backend/src/ai/`
Infrastructure for local and API-backed AI model access.

This module owns provider factories, runtime configuration, text extraction helpers, and generic parser utilities. It does not know about experiments, ranking, preprocessing, or model-search domain objects.

### `backend/src/experiments/`
Experiment lifecycle and result orchestration.

- `application/` validates experiment requests and coordinates execution jobs.
- `runtime/` manages active runs, worker processes, queues, and cancellation.
- `persistence/` centralizes experiment-result reads and writes.
- `ranking/` contains deterministic ranking, Ockham evidence assembly, and AI-assisted ranking.
- `diagnostics/` contains background enrichment for diagnostics artifacts.

### `backend/src/modeling/`
Classical machine-learning model definition, search, and diagnostics.

- `registry/` contains model specifications and model registry helpers.
- `search/` contains dataset loading, feature statistics, cross-validation, search spaces, and Optuna-backed search execution.
- `diagnostics/` contains model diagnostics generation.
- `contracts.py` defines model-search and ranking evidence contracts shared with experiments.

### `backend/src/preprocessing/`
Agentic preprocessing and deterministic dataset profiling.

This module owns profilers, profile views, operation registry, specialist agents, skills, planning, and preprocessing-plan validation.

### `backend/src/db/`
SQLite engine setup and ORM models.

This layer persists dataset records, experiment records, experiment result rows, diagnostics artifacts, and ranking outputs.

### `backend/src/config/`
Centralized runtime configuration, logging, and project paths.

### `backend/src/utils/`
Small cross-cutting utilities that do not belong to one domain module.

## Dependency direction

Preferred dependency flow:

```text
api -> experiments/preprocessing/modeling -> db/config/ai/utils
```

Important boundaries:

- `ai/` is infrastructure and should not import from `experiments/`, `modeling/`, or `preprocessing/`.
- `modeling/` should not import from `api/` or `experiments/`.
- `experiments/` may call `modeling/`, `ai/`, and `db/` because it orchestrates experiment lifecycle.
- `preprocessing/` owns its own agentic flow and should expose plans through API/runtime services, not through the modeling layer.
- `api/` should stay thin and delegate work to application modules.

## Persistence boundaries

Ockham uses two local persistence styles on purpose.

- SQLite stores metadata: datasets, experiments, result rows, progress state, ranking outputs, and diagnostics payloads.
- Runtime storage stores uploaded datasets, generated artifacts, and local execution outputs.

Local runtime folders should not be committed or shipped as source code.
