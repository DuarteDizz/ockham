import math
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import normaltest, zscore

from src.preprocessing.column_context import ColumnAnalysisContext


def safe_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None

    value = float(value)

    if math.isinf(value) or math.isnan(value):
        return None

    return value


def compute_numeric_stats(context: ColumnAnalysisContext) -> dict[str, Any]:
    if context.numeric_series is None:
        return {"is_numeric_empty": True}

    observed_series = context.numeric_series.dropna()

    if observed_series.empty:
        return {"is_numeric_empty": True}

    q1 = observed_series.quantile(0.25)
    q3 = observed_series.quantile(0.75)
    iqr = q3 - q1

    lower_iqr_bound = q1 - 1.5 * iqr
    upper_iqr_bound = q3 + 1.5 * iqr

    iqr_outliers = (observed_series < lower_iqr_bound) | (
        observed_series > upper_iqr_bound
    )

    if observed_series.nunique(dropna=True) > 1:
        z_scores = np.abs(zscore(observed_series, nan_policy="omit", ddof=1))
        zscore_outliers = z_scores > 3
        outlier_count_zscore = int(zscore_outliers.sum())
        outlier_ratio_zscore = float(zscore_outliers.mean())
    else:
        outlier_count_zscore = 0
        outlier_ratio_zscore = 0.0

    if len(observed_series) >= 8 and observed_series.nunique(dropna=True) > 1:
        _, p_value = normaltest(observed_series)
        normality_score = safe_float(p_value)
    else:
        normality_score = None

    zero_ratio = float((observed_series == 0).mean())
    skewness = observed_series.skew()

    return {
        "mean": safe_float(observed_series.mean()),
        "median": safe_float(observed_series.median()),
        "std": safe_float(observed_series.std()),
        "variance": safe_float(observed_series.var()),

        "min": safe_float(observed_series.min()),
        "p01": safe_float(observed_series.quantile(0.01)),
        "p05": safe_float(observed_series.quantile(0.05)),
        "p25": safe_float(q1),
        "p50": safe_float(observed_series.quantile(0.50)),
        "p75": safe_float(q3),
        "p95": safe_float(observed_series.quantile(0.95)),
        "p99": safe_float(observed_series.quantile(0.99)),
        "max": safe_float(observed_series.max()),

        "range": safe_float(observed_series.max() - observed_series.min()),
        "iqr": safe_float(iqr),
        "skewness": safe_float(skewness),
        "kurtosis": safe_float(observed_series.kurtosis()),
        "normality_score": normality_score,

        "zero_count": int((observed_series == 0).sum()),
        "zero_ratio": zero_ratio,
        "negative_count": int((observed_series < 0).sum()),
        "negative_ratio": float((observed_series < 0).mean()),

        "outlier_count_iqr": int(iqr_outliers.sum()),
        "outlier_ratio_iqr": float(iqr_outliers.mean()),
        "outlier_count_zscore": outlier_count_zscore,
        "outlier_ratio_zscore": outlier_ratio_zscore,

        "sparsity_score": zero_ratio,
        "is_sparse": bool(zero_ratio > 0.8),
        "is_highly_skewed": bool(abs(skewness) > 1.0),
        "has_negative_values": bool((observed_series < 0).any()),
        "has_outliers_iqr": bool(iqr_outliers.any()),
    }