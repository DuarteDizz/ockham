# Local Setup

## What you need

### Backend
- Python 3.11+
- `uv` recommended, or `pip`

### Frontend
- Node.js 18+
- npm

### Optional
- Ollama running locally if you want the LLM-assisted Ockham ranking path outside Docker

## Repository layout

From the project root:

- `backend/` contains the FastAPI app, ML execution code, ranking logic, and SQLite-backed persistence
- `frontend/` contains the Vite + React application
- `examples/` contains small CSV datasets for demo runs
- `docs/` contains the active documentation that matches the current codebase
- `scripts/` contains local validation and smoke-test helpers

## Configuration model

The project uses a single root `.env` file for both local runs and Docker.

Create it first:

```bash
cp .env.example .env
```

Important configuration facts:

- backend settings are centralized in `backend/src/config/settings.py`
- the backend reads `OCKHAM_*` variables from the root `.env`
- the frontend also reads from the same root `.env` because Vite is configured to use the repository root as its env directory
- Docker Compose overrides only the values that need to differ inside containers

## Main variables to review

At minimum, confirm these values before running locally:

- `OCKHAM_API_HOST`
- `OCKHAM_API_PORT`
- `OCKHAM_ENABLE_LLM_RANKING`
- `OCKHAM_OLLAMA_BASE_URL`
- `OCKHAM_OLLAMA_MODEL`
- `VITE_API_BASE_URL`
- `OCKHAM_FRONTEND_PROXY_TARGET`

Recommended local defaults already exist in `.env.example`.

## Backend setup

Using **uv**:

```bash
cd backend
uv sync
uv run fastapi dev main.py
```

Alternative with pip:

```bash
cd backend
pip install -r requirements.txt
python -m fastapi dev main.py
```

What happens on backend startup:

- runtime folders are created if missing
- the SQLite schema is initialized or synchronized
- the API is exposed with the routes mounted directly at `/datasets`, `/models`, and `/experiments`

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

In local development, the frontend calls `/api` and the Vite dev server proxies those requests to the backend. The upstream target is controlled by `OCKHAM_FRONTEND_PROXY_TARGET` in the same root `.env` file.

## Default local URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://127.0.0.1:8000`
- FastAPI docs: `http://127.0.0.1:8000/docs`

## Recommended local run flow

Use two terminals.

### Terminal 1

```bash
cd backend
uv sync
uv run fastapi dev main.py
```

### Terminal 2

```bash
cd frontend
npm install
npm run dev
```

Then open the frontend in your browser, upload a CSV dataset, choose the target column and models, and run an experiment.

## Quick validation

### Backend compile check

```bash
cd backend
python -m compileall main.py src
```

### Frontend production build check

```bash
cd frontend
npm install
npm run build
```

## Backend checks

From the repository root:

```bash
python scripts/run_backend_checks.py
```

This script currently runs:

- backend compile checks
- lightweight backend unit tests
- Ruff, when installed in the active Python environment

## Backend smoke test

With the API already running locally:

```bash
python scripts/smoke_backend.py
```

By default it checks:

- `GET /health`
- `GET /models?problem_type=classification`

## Common pitfalls

### `npm` cannot find `package.json`
Run frontend commands from `frontend/`, not from the repository root.

### Backend import or dependency issues
Install Python dependencies from `backend/` and make sure the active interpreter matches the project requirement.

### Frontend opens but API calls fail
Check that the backend is running and that `OCKHAM_FRONTEND_PROXY_TARGET` points to the correct local backend URL.

### Dataset upload fails
The current backend accepts CSV only and rejects files larger than 100 MB.

### LLM ranking does not respond locally
Check whether Ollama is running and whether `OCKHAM_OLLAMA_BASE_URL` matches the active local endpoint.

## Logging

The backend uses `loguru` through `backend/src/config/logging.py`.

- console logging is always enabled
- file logging is controlled by `OCKHAM_LOG_TO_FILE`
- log files are written under `backend/storage/logs/` when file logging is enabled

## Local persistence

The project stores runtime state locally:

- uploaded datasets in `backend/storage/datasets/`
- backend logs in `backend/storage/logs/`
- SQLite application state in `backend/data/ockham.db`

## Docker

For a containerized run, use the same root `.env` file:

```bash
cp .env.example .env
docker compose up --build -d
```

Default Docker endpoints:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

See [`DOCKER.md`](DOCKER.md) for the full container workflow.
