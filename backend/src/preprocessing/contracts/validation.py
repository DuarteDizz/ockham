"""Structural validation for preprocessing specialist outputs."""

from __future__ import annotations

from typing import Any

from ..operation_registry import (
    ALLOWED_COLUMN_ROLES,
    ALLOWED_RISK_LEVELS,
    ALLOWED_SEMANTIC_TYPES,
    get_allowed_operation_names,
)


def _decision_list(payload: dict[str, Any]) -> list[dict[str, Any]]:
    decisions = payload.get("decisions", []) if isinstance(payload, dict) else []
    return [decision for decision in decisions if isinstance(decision, dict)]


def validate_column_coverage(payload: dict[str, Any], *, agent_name: str, expected_columns: list[str]) -> None:
    expected = set(expected_columns)
    returned = [decision.get("column_name") for decision in _decision_list(payload)]
    returned_set = {column for column in returned if column}
    missing = sorted(expected - returned_set)
    unknown = sorted(returned_set - expected)
    errors: list[str] = []
    if missing:
        errors.append(f"{agent_name} did not analyze expected columns: {missing}.")
    if unknown:
        errors.append(f"{agent_name} returned unknown columns: {unknown}.")
    if errors:
        raise ValueError(" ".join(errors))


def validate_operation_output(payload: dict[str, Any], *, agent_name: str, stage: str, expected_columns: list[str]) -> None:
    validate_column_coverage(payload, agent_name=agent_name, expected_columns=expected_columns)
    allowed = set(get_allowed_operation_names(stage))
    errors: list[str] = []
    for decision in _decision_list(payload):
        operation = decision.get("operation")
        if operation is None:
            continue
        if operation not in allowed:
            errors.append(
                f"{agent_name} returned unsupported operation '{operation}' for column '{decision.get('column_name')}' at stage '{stage}'. Allowed operations: {sorted(allowed)}."
            )
    if errors:
        raise ValueError(" ".join(errors))


def validate_column_role_output(payload: dict[str, Any], *, expected_columns: list[str]) -> None:
    validate_column_coverage(payload, agent_name="ColumnRoleAgent", expected_columns=expected_columns)
    errors: list[str] = []
    for decision in _decision_list(payload):
        role = decision.get("recommended_role")
        risk = decision.get("risk_level")
        semantic = decision.get("semantic_type")
        column = decision.get("column_name")
        if role not in ALLOWED_COLUMN_ROLES:
            errors.append(f"ColumnRoleAgent returned invalid recommended_role '{role}' for column '{column}'.")
        if risk not in ALLOWED_RISK_LEVELS:
            errors.append(f"ColumnRoleAgent returned invalid risk_level '{risk}' for column '{column}'.")
        if semantic not in ALLOWED_SEMANTIC_TYPES:
            errors.append(f"ColumnRoleAgent returned invalid semantic_type '{semantic}' for column '{column}'.")
    if errors:
        raise ValueError(" ".join(errors))


def add_backend_metadata(payload: dict[str, Any], *, agent_name: str, stage: str | None) -> dict[str, Any]:
    normalized = dict(payload)
    decisions: list[dict[str, Any]] = []
    for decision in _decision_list(normalized):
        item = dict(decision)
        if stage and item.get("operation") is not None:
            item["stage"] = stage
            item["source_agent"] = agent_name
            item["status"] = "recommended"
        decisions.append(item)
    normalized["decisions"] = decisions
    normalized.setdefault("warnings", [])
    return normalized
