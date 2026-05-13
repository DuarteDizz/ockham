from dataclasses import dataclass

import pandas as pd


@dataclass
class ColumnAnalysisContext:
    name: str
    raw_dtype: str
    original_series: pd.Series
    observed_series: pd.Series
    observed_text_series: pd.Series | None
    numeric_series: pd.Series | None
    datetime_series: pd.Series | None
    numeric_parse_ratio: float | None
    datetime_parse_ratio: float | None
    inferred_type: str


def build_column_context(series: pd.Series) -> ColumnAnalysisContext:
    raw_dtype = str(series.dtype)
    observed_series = series.dropna()

    if pd.api.types.is_numeric_dtype(series):
        return ColumnAnalysisContext(
            name=str(series.name),
            raw_dtype=raw_dtype,
            original_series=series,
            observed_series=observed_series,
            observed_text_series=None,
            numeric_series=pd.to_numeric(series, errors="coerce"),
            datetime_series=None,
            numeric_parse_ratio=1.0,
            datetime_parse_ratio=None,
            inferred_type="numeric",
        )

    if pd.api.types.is_datetime64_any_dtype(series):
        return ColumnAnalysisContext(
            name=str(series.name),
            raw_dtype=raw_dtype,
            original_series=series,
            observed_series=observed_series,
            observed_text_series=None,
            numeric_series=None,
            datetime_series=pd.to_datetime(series, errors="coerce"),
            numeric_parse_ratio=None,
            datetime_parse_ratio=1.0,
            inferred_type="datetime",
        )

    observed_text_series = series.dropna().astype(str).str.strip()
    observed_text_series = observed_text_series[observed_text_series != ""]

    if observed_text_series.empty:
        return ColumnAnalysisContext(
            name=str(series.name),
            raw_dtype=raw_dtype,
            original_series=series,
            observed_series=observed_series,
            observed_text_series=observed_text_series,
            numeric_series=None,
            datetime_series=None,
            numeric_parse_ratio=0.0,
            datetime_parse_ratio=0.0,
            inferred_type="empty",
        )

    numeric_series = pd.to_numeric(series, errors="coerce")
    observed_numeric_series = pd.to_numeric(
        observed_text_series,
        errors="coerce",
    )

    numeric_parse_ratio = float(observed_numeric_series.notna().mean())

    if numeric_parse_ratio == 1.0:
        return ColumnAnalysisContext(
            name=str(series.name),
            raw_dtype=raw_dtype,
            original_series=series,
            observed_series=observed_series,
            observed_text_series=observed_text_series,
            numeric_series=numeric_series,
            datetime_series=None,
            numeric_parse_ratio=numeric_parse_ratio,
            datetime_parse_ratio=None,
            inferred_type="numeric_like_text",
        )

    datetime_series = pd.to_datetime(series, errors="coerce")
    observed_datetime_series = pd.to_datetime(
        observed_text_series,
        errors="coerce",
    )

    datetime_parse_ratio = float(observed_datetime_series.notna().mean())

    if datetime_parse_ratio == 1.0:
        inferred_type = "datetime_like_text"
    else:
        inferred_type = "text"

    return ColumnAnalysisContext(
        name=str(series.name),
        raw_dtype=raw_dtype,
        original_series=series,
        observed_series=observed_series,
        observed_text_series=observed_text_series,
        numeric_series=numeric_series,
        datetime_series=datetime_series,
        numeric_parse_ratio=numeric_parse_ratio,
        datetime_parse_ratio=datetime_parse_ratio,
        inferred_type=inferred_type,
    )