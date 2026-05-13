from typing import Any

from src.preprocessing.dataset_profiler import DatasetProfiler
from src.preprocessing.dataset_retriever import retrieve_dataset


class DatasetProfileService:
    def __init__(self) -> None:
        self.dataset_profiler = DatasetProfiler()

    def compute_dataset_profile(self, dataset_id: str) -> dict[str, Any]:
        df = retrieve_dataset(dataset_id)

        return self.dataset_profiler.profile_dataset(
            dataset_id=dataset_id,
            df=df,
        )