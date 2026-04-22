"""Datasets endpoint: upload, list, inspect, and delete datasets."""

import hashlib
import uuid
from pathlib import Path
from typing import Annotated, Any

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies import get_or_404, get_session
from src.api.presenters.dataset_presenter import dataset_payload
from src.api.presenters.experiment_presenter import experiment_summary_payload
from src.config import settings
from src.db.models import Dataset, Experiment, ExperimentResult

router = APIRouter(prefix="/datasets", tags=["datasets"])

DATASET_STORAGE_DIR = settings.dataset_storage_dir
DB = Annotated[Session, Depends(get_session)]
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB


@router.get("")
def list_datasets(session: DB) -> dict[str, Any]:
    """Return uploaded datasets with their finished experiment summaries."""
    dataset_records = session.execute(select(Dataset)).scalars().all()
    datasets = []

    for dataset_record in dataset_records:
        dataset_file_path = Path(dataset_record.file_path)
        dataset_size_kb = None
        if dataset_file_path.exists():
            dataset_size_kb = round(dataset_file_path.stat().st_size / 1024)

        file_type = Path(dataset_record.name).suffix.lstrip(".").lower()
        if not file_type:
            file_type = "csv"

        experiment_records = (
            session.execute(
                select(Experiment).where(
                    Experiment.dataset_id == dataset_record.id,
                    Experiment.status.in_(["done", "failed"]),
                )
            )
            .scalars()
            .all()
        )

        experiment_summaries = []
        for experiment_record in experiment_records:
            result_records = (
                session.execute(
                    select(ExperimentResult).where(
                        ExperimentResult.experiment_id == experiment_record.id
                    )
                )
                .scalars()
                .all()
            )
            experiment_summaries.append(
                experiment_summary_payload(experiment_record, result_records)
            )

        payload = dataset_payload(dataset_record)
        payload["file_type"] = file_type
        payload["size_kb"] = dataset_size_kb
        payload["experiments"] = experiment_summaries
        datasets.append(payload)

    datasets.sort(
        key=lambda item: item["created_at"] if item["created_at"] is not None else "",
        reverse=True,
    )
    return {"datasets": datasets}


@router.post("/upload")
def upload_dataset(session: DB, file: UploadFile = File(...)) -> dict[str, Any]:
    """Persist one CSV dataset and avoid duplicate uploads by content hash."""
    filename = file.filename
    if filename is None or not filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are allowed.")

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(400, "Empty file.")

    if len(file_bytes) > MAX_UPLOAD_SIZE:
        max_size_mb = MAX_UPLOAD_SIZE // (1024 * 1024)
        raise HTTPException(400, f"File too large. Maximum size is {max_size_mb} MB.")

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    existing_record = session.execute(
        select(Dataset).where(Dataset.file_hash == file_hash)
    ).scalar_one_or_none()
    if existing_record is not None:
        payload = dataset_payload(existing_record)
        payload["status"] = "already_exists"
        return payload

    dataset_id = f"dataset_{uuid.uuid4().hex}"
    DATASET_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    dataset_file_path = DATASET_STORAGE_DIR / f"{dataset_id}.csv"

    try:
        dataset_file_path.write_bytes(file_bytes)
        dataframe = pd.read_csv(dataset_file_path)

        record = Dataset(
            id=dataset_id,
            file_hash=file_hash,
            name=filename,
            file_path=str(dataset_file_path),
            rows=dataframe.shape[0],
            columns=dataframe.shape[1],
            column_names=dataframe.columns.tolist(),
            status="uploaded",
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return dataset_payload(record)
    except HTTPException:
        raise
    except Exception as exc:
        session.rollback()
        if dataset_file_path.exists():
            dataset_file_path.unlink(missing_ok=True)
        raise HTTPException(400, "Error processing dataset.") from exc


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, session: DB) -> dict[str, Any]:
    dataset_record = get_or_404(session, Dataset, dataset_id, "Dataset not found.")
    return dataset_payload(dataset_record)


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, session: DB) -> dict[str, Any]:
    """Delete one dataset together with its experiment and result rows."""
    dataset_record = get_or_404(session, Dataset, dataset_id, "Dataset not found.")
    experiment_records = (
        session.execute(select(Experiment).where(Experiment.dataset_id == dataset_id))
        .scalars()
        .all()
    )
    experiment_ids = [experiment.id for experiment in experiment_records]

    if experiment_ids:
        result_records = (
            session.execute(
                select(ExperimentResult).where(ExperimentResult.experiment_id.in_(experiment_ids))
            )
            .scalars()
            .all()
        )
        for result_record in result_records:
            session.delete(result_record)

    for experiment_record in experiment_records:
        session.delete(experiment_record)

    dataset_file_path = Path(dataset_record.file_path)
    session.delete(dataset_record)
    session.commit()

    dataset_file_path.unlink(missing_ok=True)
    return {"ok": True, "dataset_id": dataset_id}
