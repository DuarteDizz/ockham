from typing import Any

import pandas as pd

from src.preprocessing.column_profiler import ColumnProfiler


class DatasetProfiler:
    def __init__(self) -> None:
        self.column_profiler = ColumnProfiler()

    def profile_dataset(
        self,
        dataset_id: str,
        df: pd.DataFrame,
    ) -> dict[str, Any]:
        return {
            "dataset_id": dataset_id,
            "dataset_stats": self.compute_dataset_stats(df),
            "columns": [
                self.column_profiler.profile_column(df[column])
                for column in df.columns
            ],
        }

    def compute_dataset_stats(self, df: pd.DataFrame) -> dict[str, Any]:
        row_count = len(df)

        return {
            "row_count": int(row_count),
            "column_count": int(len(df.columns)),
            "duplicate_row_count": int(df.duplicated().sum()),
            "duplicate_row_ratio": float(df.duplicated().mean())
            if row_count
            else 0.0,
            "memory_usage_mb": float(
                df.memory_usage(deep=True).sum() / 1024 / 1024
            ),
        }