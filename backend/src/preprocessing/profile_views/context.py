"""Build consolidated column contexts for preprocessing agents.

The deterministic profiler is the source of evidence. This module merges that
profile with decisions already produced by earlier agents so each downstream
agent receives a compact, explicit and policy-aware view of every column.
"""

from __future__ import annotations

from typing import Any

from ..operation_registry import CAST_EFFECTIVE_TYPES
from ..state import PreprocessingState


CAST_OPERATION_TO_EFFECTIVE_TYPE = CAST_EFFECTIVE_TYPES


def _safe_float(value: Any, default: float | None = None) -> float | None:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any) -> bool:
    return bool(value) if value is not None else False


def _decision_map(payload: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    decisions = (payload or {}).get("decisions", []) or []
    mapped: dict[str, dict[str, Any]] = {}

    for decision in decisions:
        if not isinstance(decision, dict):
            continue
        column_name = decision.get("column_name")
        if column_name and column_name not in mapped:
            mapped[column_name] = decision

    return mapped


def _build_profile_lookup(state: PreprocessingState) -> dict[str, dict[str, Any]]:
    profile_columns = state.dataset_profile.get("columns", []) or []
    return {
        column.get("column_name"): column
        for column in profile_columns
        if column.get("column_name")
    }


def _is_text_like(inferred_type: str | None, semantic_type: str | None) -> bool:
    return inferred_type in {"text", "datetime_like_text", "numeric_like_text"} or semantic_type in {
        "identifier",
        "categorical_feature",
        "high_cardinality_categorical",
        "free_text",
    }


def _is_low_cardinality_categorical(
    *,
    semantic_type: str | None,
    inferred_type: str | None,
    unique_count: int | None,
    unique_ratio: float | None,
) -> bool:
    if semantic_type in {"categorical_feature", "ordinal_feature", "boolean_feature"}:
        return True

    if inferred_type not in {"text", "categorical", "boolean"}:
        return False

    if unique_count is not None and unique_count <= 30:
        return True

    if unique_ratio is not None and unique_ratio <= 0.05:
        return True

    return False


def _build_drop_policy(context: dict[str, Any]) -> tuple[bool, list[str]]:
    """Return (protected_from_drop, allowed_drop_reasons)."""
    column_name = context.get("column_name")
    semantic_type = context.get("semantic_type")
    recommended_role = context.get("recommended_role")
    inferred_type = context.get("inferred_type")
    missing_ratio = _safe_float(context.get("missing_ratio"), 0.0) or 0.0
    unique_ratio = _safe_float(context.get("unique_ratio"), 0.0) or 0.0
    unique_count = context.get("unique_count")
    avg_length = _safe_float(context.get("avg_length"), 0.0) or 0.0
    max_length = _safe_float(context.get("max_length"), 0.0) or 0.0
    is_constant = _safe_bool(context.get("is_constant"))
    is_mostly_missing = _safe_bool(context.get("is_mostly_missing"))
    is_target = _safe_bool(context.get("is_target"))
    is_low_cardinality_categorical = _safe_bool(context.get("is_low_cardinality_categorical"))

    allowed_reasons: list[str] = []

    if is_target:
        return True, []

    if is_constant:
        allowed_reasons.append("constant_column")

    if is_mostly_missing or missing_ratio >= 0.95:
        allowed_reasons.append("mostly_missing")

    if recommended_role == "drop" and semantic_type in {"identifier", "leakage_candidate", "free_text"}:
        allowed_reasons.append(f"column_role_{semantic_type}")

    if semantic_type == "identifier":
        allowed_reasons.append("identifier")

    if semantic_type == "leakage_candidate":
        allowed_reasons.append("leakage_candidate")

    if semantic_type == "free_text" and (avg_length >= 80 or max_length >= 200):
        allowed_reasons.append("unsupported_long_free_text")

    if (
        unique_ratio >= 0.98
        and _is_text_like(inferred_type, semantic_type)
        and not is_low_cardinality_categorical
    ):
        allowed_reasons.append("near_unique_text_or_identifier")

    # Low-cardinality categoricals are valuable candidates for the EncodingAgent.
    # They must not be dropped because they have few distinct values.
    if is_low_cardinality_categorical and semantic_type not in {"identifier", "leakage_candidate"}:
        return True, []

    if recommended_role in {"feature", "review"} and not allowed_reasons:
        return True, []

    if column_name and str(column_name).lower() in {"id", "index"}:
        allowed_reasons.append("identifier_name")

    return False, sorted(set(allowed_reasons))


class AgentColumnContextBuilder:
    """Create agent-specific views of deterministic profile plus prior decisions."""

    def __init__(self, state: PreprocessingState):
        self.state = state
        self.profile_by_name = _build_profile_lookup(state)
        self.role_by_name = _decision_map(state.column_role_decisions)
        self.casting_by_name = _decision_map(state.casting_decisions)
        self.drop_by_name = _decision_map(state.feature_drop_decisions)

    def build_all_contexts(self) -> list[dict[str, Any]]:
        contexts: list[dict[str, Any]] = []
        for column_name, profile in self.profile_by_name.items():
            contexts.append(self.build_column_context(column_name, profile))
        return contexts

    def build_column_context(self, column_name: str, profile: dict[str, Any]) -> dict[str, Any]:
        common = profile.get("common_stats", {}) or {}
        specific = profile.get("specific_stats", {}) or {}
        type_inference = profile.get("type_inference", {}) or {}
        role_decision = self.role_by_name.get(column_name, {}) or {}
        casting_decision = self.casting_by_name.get(column_name, {}) or {}
        drop_decision = self.drop_by_name.get(column_name, {}) or {}

        inferred_type = profile.get("inferred_type")
        cast_operation = casting_decision.get("operation")
        effective_type = CAST_OPERATION_TO_EFFECTIVE_TYPE.get(cast_operation, inferred_type)

        semantic_type = role_decision.get("semantic_type") or self._infer_semantic_type(profile)
        recommended_role = role_decision.get("recommended_role") or self._infer_role(column_name, semantic_type)
        risk_level = role_decision.get("risk_level") or "medium"

        unique_count = common.get("unique_count")
        unique_ratio = _safe_float(common.get("unique_ratio"), 0.0)
        is_low_cardinality_categorical = _is_low_cardinality_categorical(
            semantic_type=semantic_type,
            inferred_type=effective_type,
            unique_count=unique_count,
            unique_ratio=unique_ratio,
        )

        row_count = self.state.dataset_profile.get("row_count") or self.state.dataset_profile.get("n_rows")

        context: dict[str, Any] = {
            "column_name": column_name,
            "row_count": row_count,
            "raw_dtype": profile.get("raw_dtype"),
            "inferred_type": inferred_type,
            "effective_type": effective_type,
            "semantic_type": semantic_type,
            "recommended_role": recommended_role,
            "risk_level": risk_level,
            "is_target": column_name == self.state.target_column or recommended_role == "target",
            "was_dropped": drop_decision.get("operation") == "drop_column",
            "drop_reason": drop_decision.get("reason"),
            "cast_operation": cast_operation,
            "missing_ratio": common.get("missing_ratio"),
            "missing_count": common.get("missing_count"),
            "unique_count": unique_count,
            "unique_ratio": unique_ratio,
            "is_constant": common.get("is_constant"),
            "is_mostly_missing": common.get("is_mostly_missing"),
            "numeric_parse_ratio": type_inference.get("numeric_parse_ratio"),
            "datetime_parse_ratio": type_inference.get("datetime_parse_ratio"),
            "is_low_cardinality_categorical": is_low_cardinality_categorical,
            "is_high_cardinality_categorical": self._is_high_cardinality_categorical(
                semantic_type=semantic_type,
                effective_type=effective_type,
                unique_count=unique_count,
                unique_ratio=unique_ratio,
            ),
            "is_identifier_candidate": self._is_identifier_candidate(
                semantic_type=semantic_type,
                unique_ratio=unique_ratio,
                effective_type=effective_type,
            ),
            "is_free_text_candidate": semantic_type == "free_text" or (
                effective_type == "text" and (_safe_float(specific.get("avg_length"), 0.0) or 0.0) >= 80
            ),
            "mean": specific.get("mean"),
            "median": specific.get("median"),
            "std": specific.get("std"),
            "variance": specific.get("variance"),
            "min": specific.get("min"),
            "max": specific.get("max"),
            "p01": specific.get("p01"),
            "p05": specific.get("p05"),
            "p25": specific.get("p25"),
            "p50": specific.get("p50"),
            "p75": specific.get("p75"),
            "p95": specific.get("p95"),
            "p99": specific.get("p99"),
            "skewness": specific.get("skewness"),
            "kurtosis": specific.get("kurtosis"),
            "outlier_count_iqr": specific.get("outlier_count_iqr"),
            "outlier_ratio_iqr": specific.get("outlier_ratio_iqr"),
            "outlier_count_zscore": specific.get("outlier_count_zscore"),
            "outlier_ratio_zscore": specific.get("outlier_ratio_zscore"),
            "zero_ratio": specific.get("zero_ratio"),
            "negative_ratio": specific.get("negative_ratio"),
            "sparsity_score": specific.get("sparsity_score"),
            "is_sparse": specific.get("is_sparse"),
            "avg_length": specific.get("avg_length"),
            "max_length": specific.get("max_length"),
            "top_1_ratio": specific.get("top_1_ratio"),
            "top_5_ratio": specific.get("top_5_ratio"),
            "rare_value_ratio": specific.get("rare_value_ratio"),
            "normalized_entropy": specific.get("normalized_entropy"),
            "top_pattern_ratio": specific.get("top_pattern_ratio"),
            "unique_pattern_count": specific.get("unique_pattern_count"),
            "parse_success_ratio": specific.get("parse_success_ratio"),
            "timespan_days": specific.get("timespan_days"),
            "has_time_component": specific.get("has_time_component"),
            "monotonic_increasing": specific.get("monotonic_increasing"),
            "monotonic_decreasing": specific.get("monotonic_decreasing"),
        }

        context["has_missing_values"] = (_safe_float(context.get("missing_ratio"), 0.0) or 0.0) > 0.0
        context["is_bounded_0_1"] = self._is_bounded_numeric(context, lower=0.0, upper=1.0)
        context["is_bounded_0_100"] = self._is_bounded_numeric(context, lower=0.0, upper=100.0)
        context["is_ordinal_numeric_candidate"] = self._is_ordinal_numeric_candidate(context)

        protected_from_drop, allowed_drop_reasons = _build_drop_policy(context)
        context["protected_from_drop"] = protected_from_drop
        context["allowed_drop_reasons"] = allowed_drop_reasons
        return context

    def for_casting(self) -> list[dict[str, Any]]:
        return [
            context
            for context in self.build_all_contexts()
            if not context.get("is_target")
        ]

    def for_feature_drop(self) -> list[dict[str, Any]]:
        return [
            context
            for context in self.build_all_contexts()
            if not context.get("is_target")
        ]

    def for_missing_values(self) -> list[dict[str, Any]]:
        columns = []
        for context in self.build_all_contexts():
            if context.get("is_target") or context.get("was_dropped"):
                continue
            missing_ratio = _safe_float(context.get("missing_ratio"), 0.0) or 0.0
            missing_count = _safe_float(context.get("missing_count"), 0.0) or 0.0
            if missing_ratio <= 0.0 and missing_count <= 0.0:
                continue
            columns.append(context)
        return columns

    def for_datetime_features(self) -> list[dict[str, Any]]:
        columns = []
        for context in self.build_all_contexts():
            if context.get("is_target") or context.get("was_dropped"):
                continue
            if context.get("effective_type") in {"datetime", "datetime_like_text"} or context.get("semantic_type") == "datetime_feature":
                columns.append(context)
        return columns

    def for_encoding(self) -> list[dict[str, Any]]:
        columns = []
        for context in self.build_all_contexts():
            if context.get("is_target") or context.get("was_dropped"):
                continue
            if context.get("recommended_role") == "drop" or context.get("semantic_type") == "identifier":
                continue
            if context.get("effective_type") in {"text", "categorical", "boolean"}:
                columns.append(context)
                continue
            if context.get("semantic_type") in {
                "categorical_feature",
                "ordinal_feature",
                "boolean_feature",
                "high_cardinality_categorical",
            }:
                columns.append(context)
        return columns

    def for_scaling(self) -> list[dict[str, Any]]:
        columns = []
        for context in self.build_all_contexts():
            if context.get("is_target") or context.get("was_dropped"):
                continue
            if context.get("recommended_role") == "drop":
                continue
            if context.get("semantic_type") in {"categorical_feature", "ordinal_feature", "identifier", "free_text"}:
                continue
            if context.get("is_ordinal_numeric_candidate"):
                continue
            if context.get("effective_type") in {"numeric", "numeric_like_text"}:
                columns.append(context)
        return columns

    def _is_bounded_numeric(self, context: dict[str, Any], *, lower: float, upper: float) -> bool:
        if context.get("effective_type") not in {"numeric", "numeric_like_text"}:
            return False

        min_value = _safe_float(context.get("min"))
        max_value = _safe_float(context.get("max"))
        if min_value is None or max_value is None:
            return False

        tolerance = max(1e-9, (upper - lower) * 0.01)
        return min_value >= lower - tolerance and max_value <= upper + tolerance

    def _is_ordinal_numeric_candidate(self, context: dict[str, Any]) -> bool:
        if context.get("semantic_type") == "ordinal_feature":
            return True
        if context.get("effective_type") not in {"numeric", "numeric_like_text"}:
            return False
        unique_count = context.get("unique_count")
        unique_ratio = _safe_float(context.get("unique_ratio"), 1.0) or 1.0
        raw_dtype = str(context.get("raw_dtype") or "").lower()
        column_name = str(context.get("column_name") or "").lower()
        if unique_count is not None and unique_count <= 10 and unique_ratio <= 0.05:
            if "int" in raw_dtype or any(token in column_name for token in ["criticidade", "score", "rating", "class", "nivel"]):
                return True
        return False

    def _infer_semantic_type(self, profile: dict[str, Any]) -> str:
        inferred_type = profile.get("inferred_type")
        common = profile.get("common_stats", {}) or {}
        unique_count = common.get("unique_count")
        unique_ratio = _safe_float(common.get("unique_ratio"), 0.0) or 0.0

        if inferred_type in {"numeric", "numeric_like_text"}:
            return "numeric_measure"
        if inferred_type in {"datetime", "datetime_like_text"}:
            return "datetime_feature"
        if inferred_type == "boolean":
            return "boolean_feature"
        if inferred_type in {"text", "categorical"}:
            if unique_ratio >= 0.98:
                return "identifier"
            if unique_count is not None and unique_count <= 30:
                return "categorical_feature"
            return "high_cardinality_categorical"
        return "unknown"

    def _infer_role(self, column_name: str, semantic_type: str) -> str:
        if column_name == self.state.target_column:
            return "target"
        if semantic_type == "identifier":
            return "drop"
        return "feature"

    def _is_high_cardinality_categorical(
        self,
        *,
        semantic_type: str | None,
        effective_type: str | None,
        unique_count: int | None,
        unique_ratio: float | None,
    ) -> bool:
        if semantic_type == "high_cardinality_categorical":
            return True
        if effective_type not in {"text", "categorical"}:
            return False
        if unique_count is not None and unique_count > 30:
            return True
        if unique_ratio is not None and unique_ratio > 0.05:
            return True
        return False

    def _is_identifier_candidate(
        self,
        *,
        semantic_type: str | None,
        unique_ratio: float | None,
        effective_type: str | None,
    ) -> bool:
        if semantic_type == "identifier":
            return True
        if effective_type in {"text", "categorical"} and unique_ratio is not None and unique_ratio >= 0.98:
            return True
        return False
