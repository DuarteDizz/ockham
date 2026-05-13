from pathlib import Path

import pandas as pd

from src.db.database import SessionLocal
from src.db.models import Dataset


def retrieve_dataset(dataset_id: str) -> pd.DataFrame:
    with SessionLocal() as session:
        dataset_record = session.get(Dataset, dataset_id)

    if dataset_record is None:
        raise ValueError(f"Dataset not found: {dataset_id}")

    dataset_path = Path(dataset_record.file_path)

    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found: {dataset_path}")

    return pd.read_csv(dataset_path)