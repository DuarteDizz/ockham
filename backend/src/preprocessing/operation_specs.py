"""Typed preprocessing operation specifications used by backend and UI."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

SUPPORTED_EFFECTIVE_TYPES = (
    "numeric",
    "numeric_like_text",
    "categorical",
    "text",
    "boolean",
    "datetime",
    "datetime_like_text",
    "free_text",
    "identifier",
    "empty",
)


@dataclass(frozen=True)
class OperationGroupConfig:
    """Registry record describing a user-facing preprocessing operation group."""

    id: str
    label: str
    description: str
    stage: str
    order: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "stage": self.stage,
            "order": self.order,
        }


@dataclass(frozen=True)
class OperationConfig:
    """Registry record describing one supported preprocessing operation."""

    id: str
    label: str
    stage: str
    group_id: str
    description: str
    compatible_types: tuple[str, ...]
    icon_key: str
    color: str
    order: int
    cast_target_type: str | None = None
    exclusive_group: str | None = None
    agent_enabled: bool = True
    manual_enabled: bool = True
    default_params: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        unsupported_types = set(self.compatible_types) - set(SUPPORTED_EFFECTIVE_TYPES)
        if unsupported_types:
            raise ValueError(f"Operation '{self.id}' has unsupported compatible_types: {sorted(unsupported_types)}")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "stage": self.stage,
            "group_id": self.group_id,
            "description": self.description,
            "compatible_types": list(self.compatible_types),
            "cast_target_type": self.cast_target_type,
            "exclusive_group": self.exclusive_group,
            "agent_enabled": self.agent_enabled,
            "manual_enabled": self.manual_enabled,
            "default_params": dict(self.default_params),
            "order": self.order,
            "ui": {
                "icon_key": self.icon_key,
                "color": self.color,
                "group": self.group_id,
            },
        }


OPERATION_GROUPS = (
    OperationGroupConfig(
        id="casting",
        label="Column casting",
        description="Convert raw columns to the effective type used by downstream preprocessing steps.",
        stage="casting",
        order=10,
    ),
    OperationGroupConfig(
        id="missing_values",
        label="Missing values",
        description="Handle null values through safe imputation or controlled row removal before modeling.",
        stage="imputation",
        order=20,
    ),
    OperationGroupConfig(
        id="scaling",
        label="Scaling",
        description="Normalize numeric magnitudes after imputation.",
        stage="scaling",
        order=30,
    ),
    OperationGroupConfig(
        id="encoding",
        label="Encoding",
        description="Convert categorical values into model-ready features.",
        stage="encoding",
        order=40,
    ),
    OperationGroupConfig(
        id="datetime_features",
        label="Datetime features",
        description="Extract reusable date parts and remove raw timestamps.",
        stage="datetime",
        order=50,
    ),
    OperationGroupConfig(
        id="column_actions",
        label="Column actions",
        description="Remove columns that should not enter the model.",
        stage="column_action",
        order=60,
    ),
)

ALL_TYPES = SUPPORTED_EFFECTIVE_TYPES
NUMERIC_TYPES = ("numeric", "numeric_like_text")
CATEGORICAL_TYPES = ("categorical", "text")
BOOLEAN_TYPES = ("boolean",)
DATETIME_TYPES = ("datetime", "datetime_like_text")
CASTABLE_TYPES = SUPPORTED_EFFECTIVE_TYPES


OPERATION_CONFIGS = (
    OperationConfig(
        id="cast_numeric",
        label="Cast numeric",
        stage="casting",
        group_id="casting",
        description="Convert a parseable column to numeric values.",
        compatible_types=CASTABLE_TYPES,
        cast_target_type="numeric",
        icon_key="hash",
        color="#4361EE",
        order=10,
    ),
    OperationConfig(
        id="cast_datetime",
        label="Cast datetime",
        stage="casting",
        group_id="casting",
        description="Convert a parseable column to datetime values.",
        compatible_types=CASTABLE_TYPES,
        cast_target_type="datetime",
        icon_key="calendar_days",
        color="#7C3AED",
        order=20,
    ),
    OperationConfig(
        id="cast_categorical",
        label="Cast categorical",
        stage="casting",
        group_id="casting",
        description="Treat a column as categorical even when the raw dtype is ambiguous.",
        compatible_types=CASTABLE_TYPES,
        cast_target_type="categorical",
        icon_key="type",
        color="#F59E0B",
        order=30,
    ),
    OperationConfig(
        id="cast_text",
        label="Cast text",
        stage="casting",
        group_id="casting",
        description="Treat a column as text/free-form string data.",
        compatible_types=CASTABLE_TYPES,
        cast_target_type="text",
        icon_key="file_text",
        color="#64748B",
        order=40,
    ),
    OperationConfig(
        id="cast_boolean",
        label="Cast boolean",
        stage="casting",
        group_id="casting",
        description="Convert a binary-like column to boolean semantics.",
        compatible_types=CASTABLE_TYPES,
        cast_target_type="boolean",
        icon_key="toggle_left",
        color="#10B981",
        order=50,
    ),
    OperationConfig(
        id="median_imputer",
        label="Median imputer",
        stage="imputation",
        group_id="missing_values",
        description="Fill numeric missing values with the median.",
        compatible_types=NUMERIC_TYPES,
        icon_key="droplets",
        color="#06B6D4",
        order=110,
        exclusive_group="missing_value_strategy",
    ),
    OperationConfig(
        id="mean_imputer",
        label="Mean imputer",
        stage="imputation",
        group_id="missing_values",
        description="Fill numeric missing values with the mean.",
        compatible_types=NUMERIC_TYPES,
        icon_key="droplets",
        color="#06B6D4",
        order=120,
        exclusive_group="missing_value_strategy",
    ),
    OperationConfig(
        id="most_frequent_imputer",
        label="Mode imputer",
        stage="imputation",
        group_id="missing_values",
        description="Fill categorical or boolean missing values with the most frequent value.",
        compatible_types=CATEGORICAL_TYPES + BOOLEAN_TYPES,
        icon_key="droplets",
        color="#06B6D4",
        order=130,
        exclusive_group="missing_value_strategy",
    ),
    OperationConfig(
        id="constant_imputer",
        label="Constant imputer",
        stage="imputation",
        group_id="missing_values",
        description="Fill missing values with an explicit constant placeholder.",
        compatible_types=NUMERIC_TYPES + CATEGORICAL_TYPES + BOOLEAN_TYPES,
        icon_key="droplets",
        color="#06B6D4",
        order=140,
        exclusive_group="missing_value_strategy",
    ),
    OperationConfig(
        id="drop_rows_missing",
        label="Drop rows with missing",
        stage="imputation",
        group_id="missing_values",
        description="Remove rows where this column is missing when row removal is safer than imputing.",
        compatible_types=SUPPORTED_EFFECTIVE_TYPES,
        icon_key="trash_2",
        color="#EF4444",
        order=150,
        exclusive_group="missing_value_strategy",
        default_params={"scope": "missing_in_column"},
    ),
    OperationConfig(
        id="standard_scaler",
        label="Standard scaler",
        stage="scaling",
        group_id="scaling",
        description="Center and scale numeric features to unit variance.",
        compatible_types=NUMERIC_TYPES,
        icon_key="scale",
        color="#4361EE",
        order=210,
        exclusive_group="scaling_strategy",
    ),
    OperationConfig(
        id="robust_scaler",
        label="Robust scaler",
        stage="scaling",
        group_id="scaling",
        description="Scale numeric features using robust statistics when outliers or heavy tails are present.",
        compatible_types=NUMERIC_TYPES,
        icon_key="scale",
        color="#4361EE",
        order=220,
        exclusive_group="scaling_strategy",
    ),
    OperationConfig(
        id="minmax_scaler",
        label="MinMax scaler",
        stage="scaling",
        group_id="scaling",
        description="Scale numeric features to a bounded range.",
        compatible_types=NUMERIC_TYPES,
        icon_key="scale",
        color="#4361EE",
        order=230,
        exclusive_group="scaling_strategy",
    ),
    OperationConfig(
        id="maxabs_scaler",
        label="MaxAbs scaler",
        stage="scaling",
        group_id="scaling",
        description="Scale sparse or zero-dominated numeric features while preserving zero entries.",
        compatible_types=NUMERIC_TYPES,
        icon_key="scale",
        color="#4361EE",
        order=240,
        exclusive_group="scaling_strategy",
    ),
    OperationConfig(
        id="one_hot_encoder",
        label="One-hot encoder",
        stage="encoding",
        group_id="encoding",
        description="Create binary indicator features for low-cardinality nominal categories.",
        compatible_types=CATEGORICAL_TYPES,
        icon_key="tags",
        color="#F59E0B",
        order=310,
        exclusive_group="encoding_strategy",
    ),
    OperationConfig(
        id="ordinal_encoder",
        label="Ordinal encoder",
        stage="encoding",
        group_id="encoding",
        description="Encode categories when a real ordinal relationship is supported by evidence.",
        compatible_types=CATEGORICAL_TYPES,
        icon_key="tags",
        color="#F59E0B",
        order=320,
        exclusive_group="encoding_strategy",
    ),
    OperationConfig(
        id="label_encoder",
        label="Label encoder",
        stage="encoding",
        group_id="encoding",
        description="Encode a low-cardinality categorical or boolean feature as integer labels.",
        compatible_types=CATEGORICAL_TYPES + BOOLEAN_TYPES,
        icon_key="tags",
        color="#F59E0B",
        order=330,
        exclusive_group="encoding_strategy",
    ),
    OperationConfig(
        id="frequency_encoder",
        label="Frequency encoder",
        stage="encoding",
        group_id="encoding",
        description="Replace categories with their observed frequency.",
        compatible_types=CATEGORICAL_TYPES,
        icon_key="tags",
        color="#F59E0B",
        order=340,
        exclusive_group="encoding_strategy",
    ),
    OperationConfig(
        id="target_encoder",
        label="Target encoder",
        stage="encoding",
        group_id="encoding",
        description="Encode categories with target-aware statistics using leakage-safe fitting.",
        compatible_types=CATEGORICAL_TYPES,
        icon_key="tags",
        color="#F59E0B",
        order=350,
        exclusive_group="encoding_strategy",
    ),
    OperationConfig(
        id="hashing_encoder",
        label="Hashing encoder",
        stage="encoding",
        group_id="encoding",
        description="Hash high-cardinality categories into a fixed-dimensional feature space.",
        compatible_types=CATEGORICAL_TYPES,
        icon_key="tags",
        color="#F59E0B",
        order=360,
        exclusive_group="encoding_strategy",
    ),
    OperationConfig(
        id="extract_datetime_features",
        label="Datetime features",
        stage="datetime",
        group_id="datetime_features",
        description="Extract reusable date parts from datetime-like columns.",
        compatible_types=DATETIME_TYPES,
        icon_key="wand_2",
        color="#7C3AED",
        order=410,
    ),
    OperationConfig(
        id="drop_original_datetime",
        label="Drop original date",
        stage="datetime",
        group_id="datetime_features",
        description="Remove the raw timestamp after date-part feature extraction.",
        compatible_types=DATETIME_TYPES,
        icon_key="trash_2",
        color="#EF4444",
        order=420,
    ),
    OperationConfig(
        id="drop_column",
        label="Drop column",
        stage="column_action",
        group_id="column_actions",
        description="Exclude a structurally invalid, target, leakage-risk or unsupported column from the model matrix.",
        compatible_types=SUPPORTED_EFFECTIVE_TYPES,
        icon_key="trash_2",
        color="#EF4444",
        order=510,
        exclusive_group="column_action_strategy",
    ),
)
