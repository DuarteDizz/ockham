from typing import Any

from src.preprocessing.column_context import ColumnAnalysisContext


def compute_datetime_stats(context: ColumnAnalysisContext) -> dict[str, Any]:
    if context.datetime_series is None:
        return {"is_datetime_empty": True}

    observed_series = context.datetime_series.dropna()

    if observed_series.empty:
        return {
            "is_datetime_empty": True,
            "parse_success_ratio": 0.0,
            "min_datetime": None,
            "max_datetime": None,
            "timespan_days": None,
            "has_time_component": None,
            "year_unique_count": 0,
            "month_unique_count": 0,
            "day_unique_count": 0,
            "weekday_unique_count": 0,
            "hour_unique_count": 0,
            "is_monotonic_increasing": None,
            "is_monotonic_decreasing": None,
            "most_common_interval_seconds": None,
            "unique_interval_count": 0,
            "month_distribution": {},
            "weekday_distribution": {},
            "hour_distribution": {},
        }

    min_datetime = observed_series.min()
    max_datetime = observed_series.max()

    has_time_component = bool(
        (
            (observed_series.dt.hour != 0)
            | (observed_series.dt.minute != 0)
            | (observed_series.dt.second != 0)
            | (observed_series.dt.microsecond != 0)
        ).any()
    )

    sorted_series = observed_series.sort_values()
    interval_seconds = sorted_series.diff().dropna().dt.total_seconds()

    most_common_interval_seconds = None
    unique_interval_count = 0

    if not interval_seconds.empty:
        most_common_interval_seconds = float(interval_seconds.mode().iloc[0])
        unique_interval_count = int(interval_seconds.nunique())

    return {
        "parse_success_ratio": context.datetime_parse_ratio,

        "min_datetime": str(min_datetime),
        "max_datetime": str(max_datetime),
        "timespan_days": int((max_datetime - min_datetime).days),

        "has_time_component": has_time_component,

        "year_unique_count": int(observed_series.dt.year.nunique()),
        "month_unique_count": int(observed_series.dt.month.nunique()),
        "day_unique_count": int(observed_series.dt.day.nunique()),
        "weekday_unique_count": int(observed_series.dt.dayofweek.nunique()),
        "hour_unique_count": int(observed_series.dt.hour.nunique()),

        "is_monotonic_increasing": bool(observed_series.is_monotonic_increasing),
        "is_monotonic_decreasing": bool(observed_series.is_monotonic_decreasing),

        "most_common_interval_seconds": most_common_interval_seconds,
        "unique_interval_count": unique_interval_count,

        "month_distribution": {
            str(month): float(value)
            for month, value in observed_series.dt.month.value_counts(
                normalize=True
            ).sort_index().items()
        },
        "weekday_distribution": {
            str(day): float(value)
            for day, value in observed_series.dt.dayofweek.value_counts(
                normalize=True
            ).sort_index().items()
        },
        "hour_distribution": {
            str(hour): float(value)
            for hour, value in observed_series.dt.hour.value_counts(
                normalize=True
            ).sort_index().items()
        },
    }