from typing import Any

from src.preprocessing.column_context import ColumnAnalysisContext


def compute_common_stats(context: ColumnAnalysisContext) -> dict[str, Any]:
    total_count = len(context.original_series)
    observed_count = len(context.observed_series)

    missing_count = int(total_count - observed_count)
    missing_ratio = float(missing_count / total_count) if total_count else 0.0

    unique_count = int(context.observed_series.nunique(dropna=True))
    unique_ratio = float(unique_count / observed_count) if observed_count else 0.0

    return {
        "total_count": int(total_count),
        "observed_count": int(observed_count),
        "missing_count": missing_count,
        "missing_ratio": missing_ratio,
        "unique_count": unique_count,
        "unique_ratio": unique_ratio,
        "is_empty": bool(observed_count == 0),
        "is_constant": bool(unique_count <= 1 and observed_count > 0),
        "is_mostly_missing": bool(missing_ratio > 0.8),
    }