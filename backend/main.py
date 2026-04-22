"""FastAPI entrypoint for the Ockham backend."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.datasets import router as datasets_router
from src.api.routes.experiments import router as experiments_router
from src.api.routes.models import router as models_router
from src.config import configure_logging, settings
from src.db import models  # noqa: F401 - importing models is enough to register metadata.
from src.db.database import Base, engine, sync_sqlite_schema

configure_logging()


def _resolve_cors_origins(raw_value: str) -> list[str]:
    """Keep CORS parsing close to the HTTP entrypoint.

    The movie project keeps settings simple and leaves small runtime transforms
    near the place where they are used. We follow the same rule here.
    """
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _ensure_runtime_dirs() -> None:
    """Create the local folders used by the backend runtime."""
    for directory in settings.resolve_runtime_dirs():
        Path(directory).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Prepare runtime folders and the local SQLite schema."""
    _ensure_runtime_dirs()
    Base.metadata.create_all(bind=engine)
    sync_sqlite_schema()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    description=(
        "Automated model comparison using Occam's Razor: find the simplest model "
        "that adequately explains the data."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_resolve_cors_origins(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_api_safety_headers(request: Request, call_next):
    """Keep API responses conservative for local and Docker usage."""
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


# The API is intentionally small and grouped by user-facing concerns.
app.include_router(datasets_router)
app.include_router(models_router)
app.include_router(experiments_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Return a lightweight health probe for local smoke tests and Docker."""
    return {"status": "ok"}
