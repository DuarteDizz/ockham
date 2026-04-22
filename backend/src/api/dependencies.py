"""FastAPI dependencies and API-facing DB helpers."""

from collections.abc import Generator
from typing import Any, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.db.database import SessionLocal

ModelT = TypeVar("ModelT")


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_or_404(session: Session, model: type[ModelT], record_id: Any, detail: str) -> ModelT:
    record = session.get(model, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail=detail)
    return record
