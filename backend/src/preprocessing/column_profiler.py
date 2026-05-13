from typing import Any

import pandas as pd

from src.preprocessing.column_context import build_column_context
from src.preprocessing.statistics.common import compute_common_stats
from src.preprocessing.statistics.datetime import compute_datetime_stats
from src.preprocessing.statistics.numeric import compute_numeric_stats
from src.preprocessing.statistics.text import compute_text_stats


class ColumnProfiler:
    def profile_column(self, series: pd.Series) -> dict[str, Any]:
        context = build_column_context(series)

        common_stats = compute_common_stats(context)
        specific_stats = self.compute_specific_stats(context)

        return {
            "column_name": context.name,
            "raw_dtype": context.raw_dtype,
            "inferred_type": context.inferred_type,
            "type_inference": {
                "numeric_parse_ratio": context.numeric_parse_ratio,
                "datetime_parse_ratio": context.datetime_parse_ratio,
            },
            "common_stats": common_stats,
            "specific_stats": specific_stats,
        }

    def compute_specific_stats(self, context) -> dict[str, Any]:
        if context.inferred_type in {"numeric", "numeric_like_text"}:
            return compute_numeric_stats(context)

        if context.inferred_type in {"datetime", "datetime_like_text"}:
            return compute_datetime_stats(context)

        if context.inferred_type == "text":
            return compute_text_stats(context)

        return {}