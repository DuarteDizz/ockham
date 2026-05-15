"""Official preprocessing operation registry for Ockham.

The backend owns the canonical operation registry.  The same records are used
by validators, specialist agents and the frontend registry endpoint, avoiding a
second handwritten catalog in the UI.
"""

from __future__ import annotations

from typing import Any

from .operation_specs import OPERATION_CONFIGS, OPERATION_GROUPS, OperationConfig

OPERATION_REGISTRY_VERSION = "0.2.0"

OPERATION_CONFIGS_BY_ID: dict[str, OperationConfig] = {
    operation.id: operation for operation in OPERATION_CONFIGS
}
OPERATION_GROUPS_BY_ID = {group.id: group for group in OPERATION_GROUPS}

PREPROCESSING_OPERATION_REGISTRY: dict[str, dict[str, Any]] = {}
for group in OPERATION_GROUPS:
    stage_operations = {
        operation.id: operation.label
        for operation in sorted(OPERATION_CONFIGS, key=lambda item: item.order)
        if operation.stage == group.stage
    }
    PREPROCESSING_OPERATION_REGISTRY[group.stage] = {
        "label": group.label,
        "operations": stage_operations,
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
    operation.id: operation.cast_target_type
    for operation in OPERATION_CONFIGS
    if operation.cast_target_type
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


def get_operation_config(operation: str) -> OperationConfig:
    config = OPERATION_CONFIGS_BY_ID.get(operation)
    if config is None:
        raise ValueError(f"Unknown preprocessing operation: {operation}")
    return config


def get_operations_by_stage(stage: str) -> dict[str, str]:
    return dict(PREPROCESSING_OPERATION_REGISTRY.get(stage, {}).get("operations", {}))


def get_allowed_operation_names(stage: str) -> list[str]:
    return list(get_operations_by_stage(stage).keys())


def get_all_operation_names() -> set[str]:
    return set(OPERATION_CONFIGS_BY_ID)


def get_operation_stage(operation: str) -> str | None:
    config = OPERATION_CONFIGS_BY_ID.get(operation)
    return config.stage if config else None


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


def get_cast_targets() -> list[dict[str, str | None]]:
    targets = [{"label": "Keep inferred type", "operation": "", "target_type": None}]
    targets.extend(
        {
            "label": operation.label.removeprefix("Cast ").capitalize(),
            "operation": operation.id,
            "target_type": operation.cast_target_type,
        }
        for operation in sorted(OPERATION_CONFIGS, key=lambda item: item.order)
        if operation.cast_target_type
    )
    return targets


def get_compatible_operations_by_type() -> dict[str, list[str]]:
    compatible: dict[str, list[str]] = {}
    for operation in sorted(OPERATION_CONFIGS, key=lambda item: item.order):
        if not operation.manual_enabled:
            continue
        for effective_type in operation.compatible_types:
            compatible.setdefault(effective_type, []).append(operation.id)
    return compatible


def get_operation_registry_payload() -> dict[str, Any]:
    groups = []
    for group in sorted(OPERATION_GROUPS, key=lambda item: item.order):
        operations = [
            operation.id
            for operation in sorted(OPERATION_CONFIGS, key=lambda item: item.order)
            if operation.group_id == group.id and operation.manual_enabled
        ]
        group_payload = group.to_dict()
        group_payload["operations"] = operations
        groups.append(group_payload)

    return {
        "version": OPERATION_REGISTRY_VERSION,
        "stages": [
            {"id": stage, "order": order}
            for stage, order in sorted(STAGE_ORDER.items(), key=lambda item: item[1])
        ],
        "groups": groups,
        "operations": [
            operation.to_dict()
            for operation in sorted(OPERATION_CONFIGS, key=lambda item: item.order)
            if operation.manual_enabled
        ],
        "agent_stage_registry": dict(AGENT_STAGE_REGISTRY),
        "cast_operations": list(CAST_EFFECTIVE_TYPES),
        "cast_targets": get_cast_targets(),
        "cast_target_type_by_operation": dict(CAST_EFFECTIVE_TYPES),
        "compatible_operations_by_type": get_compatible_operations_by_type(),
    }


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
