"""Official preprocessing operation registry for Ockham.

This module is intentionally small: it defines the operations the application
knows how to represent/apply and exposes helpers used by structural validators,
plan merging and skill-driven agents. Specialist reasoning lives in
``preprocessing/skills``; prompt construction no longer belongs here.
"""

from __future__ import annotations

from typing import Any


PREPROCESSING_OPERATION_REGISTRY: dict[str, dict[str, Any]] = {
    "casting": {
        "label": "Column casting",
        "operations": {
            "cast_numeric": "Cast numeric",
            "cast_datetime": "Cast datetime",
            "cast_categorical": "Cast categorical",
            "cast_text": "Cast text",
            "cast_boolean": "Cast boolean",
        },
    },
    "imputation": {
        "label": "Missing values",
        "operations": {
            "mean_imputer": "Mean imputer",
            "median_imputer": "Median imputer",
            "most_frequent_imputer": "Most frequent imputer",
            "constant_imputer": "Constant imputer",
        },
    },
    "scaling": {
        "label": "Feature scaling",
        "operations": {
            "standard_scaler": "Standard scaler",
            "robust_scaler": "Robust scaler",
            "minmax_scaler": "MinMax scaler",
            "maxabs_scaler": "MaxAbs scaler",
        },
    },
    "encoding": {
        "label": "Categorical encoding",
        "operations": {
            "one_hot_encoder": "One-hot encoder",
            "ordinal_encoder": "Ordinal encoder",
            "label_encoder": "Label encoder",
            "frequency_encoder": "Frequency encoder",
            "target_encoder": "Target encoder",
            "hashing_encoder": "Hashing encoder",
        },
    },
    "datetime": {
        "label": "Datetime features",
        "operations": {
            "extract_datetime_features": "Extract datetime features",
            "drop_original_datetime": "Drop original datetime",
        },
    },
    "column_action": {
        "label": "Column actions",
        "operations": {
            "drop_column": "Drop column",
        },
    },
}

AGENT_STAGE_REGISTRY: dict[str, str] = {
    "CastingAgent": "casting",
    "FeatureDropAgent": "column_action",
    "MissingValueAgent": "imputation",
    "DatetimeFeatureAgent": "datetime",
    "EncodingAgent": "encoding",
    "ScalingAgent": "scaling",
}

STAGE_ORDER: dict[str, int] = {
    "column_action": 0,
    "casting": 1,
    "imputation": 2,
    "datetime": 3,
    "encoding": 4,
    "scaling": 5,
}

CAST_EFFECTIVE_TYPES: dict[str, str] = {
    "cast_numeric": "numeric",
    "cast_datetime": "datetime",
    "cast_boolean": "boolean",
    "cast_categorical": "categorical",
    "cast_text": "text",
}

ALLOWED_COLUMN_ROLES = {"feature", "target", "drop", "review"}
ALLOWED_RISK_LEVELS = {"low", "medium", "high"}
ALLOWED_SEMANTIC_TYPES = {
    "identifier",
    "free_text",
    "numeric_measure",
    "categorical_feature",
    "boolean_feature",
    "datetime_feature",
    "high_cardinality_categorical",
    "leakage_candidate",
    "ordinal_feature",
    "target",
    "unknown",
}


def get_operations_by_stage(stage: str) -> dict[str, str]:
    return dict(PREPROCESSING_OPERATION_REGISTRY.get(stage, {}).get("operations", {}))


def get_allowed_operation_names(stage: str) -> list[str]:
    return list(get_operations_by_stage(stage).keys())


def get_all_operation_names() -> set[str]:
    operations: set[str] = set()
    for stage_config in PREPROCESSING_OPERATION_REGISTRY.values():
        operations.update(stage_config.get("operations", {}).keys())
    return operations


def get_operation_stage(operation: str) -> str | None:
    for stage, stage_config in PREPROCESSING_OPERATION_REGISTRY.items():
        if operation in stage_config.get("operations", {}):
            return stage
    return None


def is_known_operation(operation: str | None) -> bool:
    if operation is None:
        return True
    return operation in get_all_operation_names()


def get_agent_stage(agent_name: str) -> str | None:
    return AGENT_STAGE_REGISTRY.get(agent_name)


def get_agent_allowed_operations(agent_name: str) -> list[str]:
    stage = get_agent_stage(agent_name)
    if not stage:
        return []
    return get_allowed_operation_names(stage)


def format_allowed_operations(stage: str) -> str:
    operations = get_operations_by_stage(stage)
    if not operations:
        return "- None"
    return "\n".join(f"- {operation}: {label}" for operation, label in operations.items())


def normalize_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    return [str(value)]


def normalize_confidence(value: object, default: float = 0.75) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return default
    return max(0.0, min(1.0, confidence))
