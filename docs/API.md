# API Reference

Ockham keeps the API surface deliberately small and grouped by user-facing concerns.

There is no `/api/v1/...` prefix in the current backend. The application mounts routes directly at `/health`, `/datasets`, `/models`, and `/experiments`.

## Base behavior

### OpenAPI docs
FastAPI serves the generated API docs at:

- `/docs`
- `/openapi.json`

### Response headers
The backend adds conservative HTTP headers to API responses for local and Docker usage, including no-store cache control and common browser hardening headers.

## Health

### `GET /health`
Returns a lightweight readiness probe used by smoke tests and Docker healthchecks.

Example response:

```json
{
  "status": "ok"
}
```

## Datasets

### `GET /datasets`
Returns uploaded datasets together with finished or failed experiment summaries for each dataset.

Top-level response shape:

```json
{
  "datasets": [
    {
      "dataset_id": "dataset_xxx",
      "name": "customer_churn.csv",
      "rows": 1000,
      "columns": 20,
      "column_names": ["churn", "tenure", "monthly_fee"],
      "status": "uploaded",
      "created_at": "2026-04-20T18:00:00",
      "file_type": "csv",
      "size_kb": 128,
      "experiments": []
    }
  ]
}
```

### `POST /datasets/upload`
Uploads one dataset file.

Current behavior:

- accepts **CSV only**
- rejects empty files
- rejects files over **100 MB**
- deduplicates repeated uploads by file hash
- returns the existing dataset payload with `status: "already_exists"` when the same file content is uploaded again

Typical success response:

```json
{
  "dataset_id": "dataset_xxx",
  "name": "customer_churn.csv",
  "rows": 1000,
  "columns": 20,
  "column_names": ["churn", "tenure", "monthly_fee"],
  "status": "uploaded",
  "created_at": "2026-04-20T18:00:00"
}
```

Typical client errors:

- `400` for non-CSV uploads
- `400` for empty files
- `400` for files larger than 100 MB
- `400` for CSV processing failures

### `GET /datasets/{dataset_id}`
Returns one dataset record.

### `DELETE /datasets/{dataset_id}`
Deletes the dataset, its stored CSV file, and related experiment and result rows.

Success response:

```json
{
  "ok": true,
  "dataset_id": "dataset_xxx"
}
```

## Models

### `GET /models?problem_type=classification`
### `GET /models?problem_type=regression`
Returns the available model catalog for the requested problem type.

Example response:

```json
{
  "problem_type": "classification",
  "models": [
    {
      "id": "logistic_regression",
      "name": "Logistic Regression",
      "category": "Linear Models",
      "problem_type": "classification",
      "search_backend": "optuna"
    }
  ]
}
```

Validation behavior:

- `400` when `problem_type` is not one of the supported problem types

## Experiments

### `POST /experiments/run`
Creates one experiment record and starts background execution.

Request body:

```json
{
  "dataset_id": "dataset_xxx",
  "problem_type": "classification",
  "target_column": "churn",
  "selected_models": ["logistic_regression", "random_forest"]
}
```

Immediate response:

```json
{
  "experiment_id": "experiment_xxx",
  "dataset_id": "dataset_xxx",
  "problem_type": "classification",
  "target_column": "churn",
  "selected_models": ["logistic_regression", "random_forest"],
  "status": "queued",
  "progress": 0,
  "training_state": [
    {
      "id": "logistic_regression",
      "name": "Logistic Regression",
      "status": "pending"
    }
  ],
  "live_step": "queue",
  "live_message": "Preparing experiment and waiting to start workers.",
  "started_at": "2026-04-20T18:00:00"
}
```

Notes:

- execution starts in a background thread after the record is created
- the frontend is expected to poll the experiment status endpoint

### `GET /experiments/by-dataset/{dataset_id}`
Lists finished and failed experiments for one dataset.

Top-level response shape:

```json
{
  "dataset_id": "dataset_xxx",
  "experiments": [
    {
      "id": "experiment_xxx",
      "run_at": "2026-04-20T18:00:00",
      "problem_type": "classification",
      "target_column": "churn",
      "status": "done",
      "progress": 100,
      "selected_models": ["logistic_regression", "random_forest"],
      "models": ["Logistic Regression", "Random Forest"],
      "best_model_by_ockham": "Random Forest",
      "best_score_by_ockham": 0.91,
      "best_model": "Random Forest",
      "best_score": 0.91,
      "best_model_by_score": "Random Forest",
      "best_score_by_score": 0.91,
      "primary_metric": "f1",
      "ranking_mode": "ockham"
    }
  ]
}
```

### `GET /experiments/{experiment_id}`
Returns the live status payload for one experiment.

Important fields:

- `status`
- `progress`
- `training_state`
- `live_step`
- `live_message`

Typical status values seen in the code path include:

- `queued`
- `running`
- `cancel_requested`
- `cancelled`
- `failed`
- `done`

### `POST /experiments/{experiment_id}/abort`
Requests cancellation for a running experiment.

Behavior:

- returns `409` if the experiment has already finished or failed
- marks pending or active model entries as cancelled in `training_state`
- signals the runtime layer to stop active workers

### `DELETE /experiments/{experiment_id}`
Deletes the experiment and all persisted result rows.

Success response:

```json
{
  "ok": true,
  "experiment_id": "experiment_xxx"
}
```

## Results and diagnostics

### `GET /experiments/{experiment_id}/results?ranking_mode=ockham`
### `GET /experiments/{experiment_id}/results?ranking_mode=score`
Returns ranked result payloads for one experiment.

Supported `ranking_mode` values:

- `ockham`
- `score`

Validation behavior:

- `400` for invalid ranking modes
- `404` when the experiment does not exist

Each result item includes the model identity, the main score payload, Ockham evidence blocks, capability profile data, timing metrics, Optuna information, and embedded diagnostics when already available.

Key result fields include:

- `model_id`
- `model_name`
- `primary_metric`
- `best_score`
- `metrics_mean`
- `metrics_std`
- `performance_rank`
- `ockham_rank`
- `is_ockham_recommended`
- `score_context`
- `performance_evidence`
- `structural_profile`
- `execution_profile`
- `feature_usage_context`
- `operational_context`
- `optuna`
- `capability_profile`
- `embedded_diagnostics`

### `GET /experiments/{experiment_id}/models/{model_id}/diagnostics`
Returns the diagnostics payload for one model.

Supported query parameters:

- `scope=full|minimal`
- `validation_param=<param_name>`

Behavior:

- returns `404` if the model result does not exist for the experiment
- returns `400` for an invalid diagnostics scope
- rebuilds missing diagnostics lazily when the persisted record is incomplete and enough information is available to regenerate the artifacts

The diagnostics payload can include:

- `cv_fold_scores`
- `confusion_matrix`
- `roc_curve`
- `learning_curve`
- `validation_curve`
- `actual_vs_predicted`
- `available_validation_params`
- `selected_validation_param`
- `capability_profile`

## Practical API flow

A normal client flow is:

1. `POST /datasets/upload`
2. `GET /models?problem_type=...`
3. `POST /experiments/run`
4. poll `GET /experiments/{experiment_id}`
5. `GET /experiments/{experiment_id}/results?ranking_mode=ockham`
6. `GET /experiments/{experiment_id}/models/{model_id}/diagnostics`

## Notes

- The backend routes are mounted directly on the FastAPI app.
- The frontend typically reaches the backend through `/api` in development and Docker because the proxy layer rewrites requests upstream.
- The source of truth for exact live schemas remains the FastAPI-generated OpenAPI docs at `/docs`.
