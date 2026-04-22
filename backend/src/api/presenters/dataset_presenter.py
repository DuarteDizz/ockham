"""Dataset presenters: serialize dataset records for the API layer."""

from typing import Any


def dataset_payload(dataset) -> dict[str, Any]:
    return {
        "dataset_id": dataset.id,
        "name": dataset.name,
        "rows": dataset.rows,
        "columns": dataset.columns,
        "column_names": dataset.column_names or [],
        "status": dataset.status,
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
    }
