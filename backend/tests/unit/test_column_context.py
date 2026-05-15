import pandas as pd

from src.preprocessing.column_context import build_column_context
from src.preprocessing.column_profiler import ColumnProfiler


def test_bool_dtype_is_inferred_as_boolean_before_numeric():
    series = pd.Series([True, False, True, None], name="is_active", dtype="boolean")

    context = build_column_context(series)

    assert context.raw_dtype == "boolean"
    assert context.inferred_type == "boolean"
    assert context.numeric_series is None
    assert context.observed_text_series is not None
    assert set(context.observed_text_series.astype(str)) == {"True", "False"}


def test_categorical_dtype_is_inferred_as_categorical():
    series = pd.Series(
        pd.Categorical(["gold", "silver", "gold", None]),
        name="customer_tier",
    )

    context = build_column_context(series)

    assert context.raw_dtype == "category"
    assert context.inferred_type == "categorical"
    assert context.numeric_series is None
    assert context.observed_text_series is not None
    assert list(context.observed_text_series) == ["gold", "silver", "gold"]


def test_profiler_computes_categorical_specific_stats():
    series = pd.Series(
        pd.Categorical(["gold", "silver", "gold", "bronze", None]),
        name="customer_tier",
    )

    profile = ColumnProfiler().profile_column(series)

    assert profile["inferred_type"] == "categorical"
    assert profile["specific_stats"]["top_1_ratio"] == 0.5
    assert profile["specific_stats"]["masked_top_distribution"]


def test_profiler_computes_boolean_specific_stats():
    series = pd.Series([True, False, True, True, None], name="is_active", dtype="boolean")

    profile = ColumnProfiler().profile_column(series)

    assert profile["inferred_type"] == "boolean"
    assert profile["specific_stats"]["top_1_ratio"] == 0.75
