# Docker

## What this stack provides

The repository includes a local Docker stack that runs the full application with the optional LLM path available.

Services:

- `ollama` runs the local LLM server on port `11434`
- `ollama-init` waits for Ollama and pulls the configured model
- `backend` runs the FastAPI application on port `8000`
- `frontend` builds the React app and serves it through Nginx on port `8080`

The frontend is built with `VITE_API_BASE_URL=/api`, and Nginx proxies `/api/*` requests to the backend container.

## Configuration model

Docker uses the same root `.env` file used by local development.

Start by copying the example:

```bash
cp .env.example .env
```

How configuration works:

- `backend/src/config/settings.py` remains the backend source of truth
- the root `.env` keeps the standard local defaults
- Docker Compose overrides only the variables that must differ inside containers, such as the API bind address and the Ollama hostname

## Default run

From the project root:

```bash
docker compose up --build -d
```

Check status:

```bash
docker compose ps
```

Then open:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- FastAPI docs: `http://localhost:8000/docs`
- FastAPI docs through the frontend proxy: `http://localhost:8080/api/docs`

## Service startup order

The compose file encodes a simple startup sequence:

1. `ollama` starts and waits until its healthcheck passes.
2. `backend` starts after Ollama is reachable.
3. `frontend` starts after the backend healthcheck passes.
4. `ollama-init` pulls the configured model once the Ollama API is ready.

This means the web app can open before the selected model has finished downloading. The LLM-assisted ranking flow should only be used after `ollama-init` completes successfully.

Check that with:

```bash
docker compose logs -f ollama-init
```

When the logs end with `Ollama model pull finished.`, the model is ready.

## LLM behavior in Docker

The root `.env` usually contains local defaults such as:

```bash
OCKHAM_ENABLE_LLM_RANKING=true
OCKHAM_OLLAMA_BASE_URL=http://127.0.0.1:11434
OCKHAM_OLLAMA_MODEL=llama3.2:3b
```

Docker Compose overrides the base URL inside the container network so the backend talks to `http://ollama:11434` instead of localhost.

Relevant runtime overrides in Compose include:

- `OCKHAM_API_HOST=0.0.0.0`
- `OCKHAM_OLLAMA_BASE_URL=http://ollama:11434`
- `VITE_API_BASE_URL=/api`

## Persisted data

The stack uses named Docker volumes for:

- SQLite data under `backend/data/`
- uploaded datasets under `backend/storage/datasets/`
- backend logs under `backend/storage/logs/`
- Ollama model data

This keeps application state across container restarts.

## Common operations

### Rebuild and start

```bash
docker compose up --build -d
```

### Stop the stack

```bash
docker compose down
```

### Reset everything, including volumes

```bash
docker compose down -v
```

### Follow backend logs

```bash
docker compose logs -f backend
```

### Follow frontend logs

```bash
docker compose logs -f frontend
```

### Follow Ollama logs

```bash
docker compose logs -f ollama
```

## If Ollama does not start

Inspect the logs in this order:

```bash
docker compose logs --tail 200 ollama
docker compose logs --tail 200 ollama-init
```

Common causes:

- model download blocked by proxy or network policy
- insufficient disk space for the model
- insufficient memory for the selected model

If your environment requires a corporate proxy for model downloads, set `HTTPS_PROXY` in `.env` before starting the stack.

## Changing the model

Edit `.env` before starting the stack:

```bash
OCKHAM_OLLAMA_MODEL=llama3.2:3b
```

Then restart:

```bash
docker compose up --build -d
```

If you want to repull the image and clear persisted state too:

```bash
docker compose down -v
docker compose up --build -d
```

## Notes

- The Docker frontend is served by Nginx with a 100 MB upload limit so dataset uploads work through the web UI.
- The backend remains directly reachable on port `8000`.
- The Ollama server is configured to bind to `0.0.0.0:11434` inside the container.
- The frontend talks to the backend through `/api`, not by calling the backend container directly from the browser.
