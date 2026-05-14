"""Agent-specific profiler views.

The deterministic profiler remains the source of evidence. Profile views decide
which evidence each specialist agent sees. They are intentionally separate from
skills: skills explain *how* to reason, views define *what data* is available.
"""

from __future__ import annotations

from typing import Any

from .context import AgentColumnContextBuilder
from ..state import PreprocessingState


def _copy(source: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    return {key: source.get(key) for key in keys if key in source}


class ProfileViewBuilder:
    """Build minimal but technically rich views for each preprocessing skill."""

    def __init__(self, state: PreprocessingState):
        self.state = state
        self.context_builder = AgentColumnContextBuilder(state)

    def for_agent(self, agent_name: str) -> list[dict[str, Any]]:
        dispatch = {
            "ColumnRoleAgent": self.for_column_role,
            "CastingAgent": self.for_casting,
            "FeatureDropAgent": self.for_feature_drop,
            "MissingValueAgent": self.for_missing_values,
            "DatetimeFeatureAgent": self.for_datetime_features,
            "EncodingAgent": self.for_encoding,
            "ScalingAgent": self.for_scaling,
        }
        return dispatch[agent_name]()

    def for_column_role(self) -> list[dict[str, Any]]:
        views: list[dict[str, Any]] = []
        row_count = self.state.dataset_profile.get("row_count") or self.state.dataset_profile.get("n_rows")
        for column in self.state.dataset_profile.get("columns", []) or []:
            common = column.get("common_stats", {}) or {}
            specific = column.get("specific_stats", {}) or {}
            type_inference = column.get("type_inference", {}) or {}
            column_name = column.get("column_name")
            views.append(
                {
                    "column_name": column_name,
                    "row_count": row_count,
                    "raw_dtype": column.get("raw_dtype"),
                    "inferred_type": column.get("inferred_type"),
                    "is_target": column_name == self.state.target_column,
                    "target_column": self.state.target_column,
                    **_copy(
                        common,
                        [
                            "missing_count",
                            "missing_ratio",
                            "unique_count",
                            "unique_ratio",
                            "is_constant",
                            "is_mostly_missing",
                        ],
                    ),
                    **_copy(
                        specific,
                        [
                            "avg_length",
                            "max_length",
                            "top_1_ratio",
                            "top_5_ratio",
                            "rare_value_ratio",
                            "normalized_entropy",
                            "unique_pattern_count",
                            "top_pattern_ratio",
                        ],
                    ),
                    **_copy(type_inference, ["numeric_parse_ratio", "datetime_parse_ratio"]),
                }
            )
        return views

    def for_casting(self) -> list[dict[str, Any]]:
        return [
            _copy(
                context,
                [
                    "column_name",
                    "raw_dtype",
                    "inferred_type",
                    "effective_type",
                    "semantic_type",
                    "recommended_role",
                    "risk_level",
                    "numeric_parse_ratio",
                    "datetime_parse_ratio",
                    "unique_count",
                    "unique_ratio",
                    "avg_length",
                    "max_length",
                    "is_low_cardinality_categorical",
                    "is_high_cardinality_categorical",
                ],
            )
            for context in self.context_builder.for_casting()
        ]

    def for_feature_drop(self) -> list[dict[str, Any]]:
        return [
            _copy(
                context,
                [
                    "column_name",
                    "row_count",
                    "semantic_type",
                    "recommended_role",
                    "risk_level",
                    "missing_count",
                    "missing_ratio",
                    "unique_count",
                    "unique_ratio",
                    "is_constant",
                    "is_mostly_missing",
                    "is_identifier_candidate",
                    "is_free_text_candidate",
                    "is_low_cardinality_categorical",
                    "is_high_cardinality_categorical",
                    "avg_length",
                    "max_length",
                    "protected_from_drop",
                    "allowed_drop_reasons",
                ],
            )
            for context in self.context_builder.for_feature_drop()
        ]

    def for_missing_values(self) -> list[dict[str, Any]]:
        return [
            _copy(
                context,
                [
                    "column_name",
                    "row_count",
                    "raw_dtype",
                    "effective_type",
                    "semantic_type",
                    "recommended_role",
                    "missing_count",
                    "missing_ratio",
                    "unique_count",
                    "unique_ratio",
                    "mean",
                    "median",
                    "std",
                    "skewness",
                    "kurtosis",
                    "outlier_count_iqr",
                    "outlier_ratio_iqr",
                    "outlier_count_zscore",
                    "outlier_ratio_zscore",
                    "top_1_ratio",
                    "rare_value_ratio",
                    "is_low_cardinality_categorical",
                ],
            )
            for context in self.context_builder.for_missing_values()
        ]

    def for_datetime_features(self) -> list[dict[str, Any]]:
        return [
            _copy(
                context,
                [
                    "column_name",
                    "effective_type",
                    "semantic_type",
                    "datetime_parse_ratio",
                    "parse_success_ratio",
                    "min_datetime",
                    "max_datetime",
                    "timespan_days",
                    "has_time_component",
                    "monotonic_increasing",
                    "monotonic_decreasing",
                    "unique_count",
                    "unique_ratio",
                ],
            )
            for context in self.context_builder.for_datetime_features()
        ]

    def for_encoding(self) -> list[dict[str, Any]]:
        return [
            _copy(
                context,
                [
                    "column_name",
                    "effective_type",
                    "semantic_type",
                    "recommended_role",
                    "risk_level",
                    "unique_count",
                    "unique_ratio",
                    "top_1_ratio",
                    "top_5_ratio",
                    "rare_value_ratio",
                    "normalized_entropy",
                    "is_low_cardinality_categorical",
                    "is_high_cardinality_categorical",
                    "is_identifier_candidate",
                    "avg_length",
                    "max_length",
                ],
            )
            for context in self.context_builder.for_encoding()
        ]

    def for_scaling(self) -> list[dict[str, Any]]:
        return [
            _copy(
                context,
                [
                    "column_name",
                    "row_count",
                    "effective_type",
                    "semantic_type",
                    "recommended_role",
                    "missing_count",
                    "missing_ratio",
                    "mean",
                    "median",
                    "std",
                    "variance",
                    "min",
                    "max",
                    "p01",
                    "p05",
                    "p25",
                    "p50",
                    "p75",
                    "p95",
                    "p99",
                    "skewness",
                    "kurtosis",
                    "outlier_count_iqr",
                    "outlier_ratio_iqr",
                    "outlier_count_zscore",
                    "outlier_ratio_zscore",
                    "zero_ratio",
                    "negative_ratio",
                    "sparsity_score",
                    "is_sparse",
                    "is_bounded_0_1",
                    "is_bounded_0_100",
                    "is_ordinal_numeric_candidate",
                ],
            )
            for context in self.context_builder.for_scaling()
        ]
