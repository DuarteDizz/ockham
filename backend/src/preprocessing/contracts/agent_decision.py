"""Common Pydantic contracts for preprocessing specialist agents."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def normalize_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    return [str(value)]


NO_OPERATION_ALIASES = {
    "",
    "none",
    "null",
    "nil",
    "n/a",
    "na",
    "false",
    "keep",
    "skip",
    "pass",
    "retain",
    "unchanged",
    "not_needed",
    "not_applicable",
    "no_action",
    "no_operation",
    "null_operation",
    "null_operation_meaning",
    "no_change",
    "do_not_modify",
    "do_not_drop",
    "keep_column",
    "retain_column",
    "no_drop",
    "no_cast",
    "no_imputation",
    "no_datetime_action",
    "no_encoding",
    "no_scaling",
}


def normalize_operation(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
        if normalized in NO_OPERATION_ALIASES:
            return None
        return value.strip()
    return None


class AgentDecision(BaseModel):
    column_name: str
    operation: str | None = None
    confidence: float = Field(default=0.75, ge=0.0, le=1.0)
    reason: str = ""
    evidence: dict[str, Any] = Field(default_factory=dict)
    alternatives_considered: list[dict[str, Any]] = Field(default_factory=list)
    params: dict[str, Any] = Field(default_factory=dict)
    requires_user_review: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_shape(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if "column_name" not in normalized:
            for key in ("column", "name", "field", "feature"):
                if normalized.get(key):
                    normalized["column_name"] = normalized.get(key)
                    break

        if "operation" not in normalized:
            for key in ("action", "preferred_operation", "method", "scaler", "encoder"):
                if key in normalized:
                    normalized["operation"] = normalized.get(key)
                    break

        operation = normalized.get("operation")
        if isinstance(operation, dict):
            for key in ("operation", "preferred_operation", "method", "scaler", "encoder"):
                if key in operation:
                    operation = operation.get(key)
                    break
        normalized["operation"] = normalize_operation(operation)
        normalized.setdefault("confidence", 0.75)
        normalized.setdefault("reason", "")
        normalized.setdefault("evidence", {})
        normalized.setdefault("alternatives_considered", [])
        normalized.setdefault("params", {})
        normalized.setdefault("requires_user_review", False)
        return normalized


class AgentDecisionBatch(BaseModel):
    agent_name: str
    decisions: list[AgentDecision] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_output_shape(cls, value: object) -> object:
        if isinstance(value, list):
            return {"decisions": value, "warnings": []}
        if not isinstance(value, dict):
            return value
        if "decisions" in value:
            return value

        decisions: list[dict[str, Any]] = []
        ignored = {
            "agent_name",
            "warnings",
            "system",
            "response",
            "metadata",
            "columns",
            "features",
            "items",
            "stage",
            "expected_columns",
            "output_contract",
            "available_operations",
            "null_operation_meaning",
            "forbidden",
        }
        for key, item in value.items():
            if key in ignored:
                continue
            if isinstance(item, dict):
                decision = dict(item)
                decision.setdefault("column_name", key)
                decisions.append(decision)
            else:
                decisions.append({"column_name": key, "operation": item})
        return {
            "agent_name": value.get("agent_name", ""),
            "decisions": decisions,
            "warnings": value.get("warnings", []),
        }

    @field_validator("warnings", mode="before")
    @classmethod
    def normalize_warnings(cls, value: object) -> list[str]:
        return normalize_string_list(value)


class ColumnRoleDecision(BaseModel):
    column_name: str
    semantic_type: str = "unknown"
    recommended_role: Literal["feature", "target", "drop", "review"] = "review"
    risk_level: Literal["low", "medium", "high"] = "medium"
    confidence: float = Field(default=0.75, ge=0.0, le=1.0)
    reason: str = ""
    evidence: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_role_shape(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if "column_name" not in normalized:
            for key in ("column", "name", "field", "feature"):
                if normalized.get(key):
                    normalized["column_name"] = normalized.get(key)
                    break
        action = str(normalized.get("action", "")).strip().lower()
        if action and not normalized.get("recommended_role"):
            normalized["recommended_role"] = {
                "keep": "feature",
                "use": "feature",
                "feature": "feature",
                "target": "target",
                "drop": "drop",
                "remove": "drop",
                "review": "review",
            }.get(action, "review")

        semantic = str(normalized.get("semantic_type") or normalized.get("type") or "").strip().lower()
        aliases = {
            "id": "identifier",
            "identifier": "identifier",
            "numeric": "numeric_measure",
            "number": "numeric_measure",
            "numerical": "numeric_measure",
            "float": "numeric_measure",
            "integer": "numeric_measure",
            "int": "numeric_measure",
            "categorical": "categorical_feature",
            "category": "categorical_feature",
            "object": "categorical_feature",
            "boolean": "boolean_feature",
            "bool": "boolean_feature",
            "datetime": "datetime_feature",
            "date": "datetime_feature",
            "text": "free_text",
            "free_text": "free_text",
        }
        normalized["semantic_type"] = aliases.get(semantic, semantic or "unknown")

        risk = str(normalized.get("risk_level", "")).strip().lower()
        normalized["risk_level"] = {
            "none": "low",
            "safe": "low",
            "minor": "low",
            "moderate": "medium",
            "med": "medium",
            "review": "medium",
            "risky": "high",
            "critical": "high",
        }.get(risk, risk or "medium")
        normalized.setdefault("confidence", 0.75)
        normalized.setdefault("reason", "")
        normalized.setdefault("evidence", {})
        return normalized


class ColumnRoleDecisionBatch(BaseModel):
    agent_name: str = "ColumnRoleAgent"
    decisions: list[ColumnRoleDecision] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_output_shape(cls, value: object) -> object:
        if isinstance(value, list):
            return {"agent_name": "ColumnRoleAgent", "decisions": value, "warnings": []}
        if not isinstance(value, dict):
            return value
        if "decisions" in value:
            return value
        decisions = []
        for key, item in value.items():
            if key in {"agent_name", "warnings"}:
                continue
            if isinstance(item, dict):
                decision = dict(item)
                decision.setdefault("column_name", key)
                decisions.append(decision)
        return {
            "agent_name": value.get("agent_name", "ColumnRoleAgent"),
            "decisions": decisions,
            "warnings": value.get("warnings", []),
        }

    @field_validator("warnings", mode="before")
    @classmethod
    def normalize_warnings(cls, value: object) -> list[str]:
        return normalize_string_list(value)
