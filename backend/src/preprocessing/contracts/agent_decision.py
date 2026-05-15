"""Common Pydantic contracts for preprocessing specialist agents.

The model-facing contract is intentionally compact. Local models only need to
produce the decision core; the backend fills operational metadata such as
``agent_name``, ``warnings``, ``params`` and review flags.
"""

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
    if isinstance(value, dict):
        for key in ("operation", "preferred_operation", "method", "scaler", "encoder", "action"):
            if key in value:
                return normalize_operation(value.get(key))
    return None


def normalize_alternatives(value: object) -> list[dict[str, Any]]:
    """Accept compact alternatives from local models and canonicalize them."""
    if value is None:
        return []

    items: list[object]
    if isinstance(value, list):
        items = value
    else:
        items = [value]

    alternatives: list[dict[str, Any]] = []
    for item in items:
        if item is None:
            continue
        if isinstance(item, str):
            alternatives.append({"operation": normalize_operation(item), "reason_not_selected": ""})
            continue
        if isinstance(item, dict):
            alternative = dict(item)
            if "reason_not_selected" not in alternative:
                for key in ("reason", "why_not", "explanation"):
                    if key in alternative:
                        alternative["reason_not_selected"] = str(alternative.get(key) or "")
                        break
            if "operation" not in alternative:
                for key in ("candidate", "alternative", "method", "scaler", "encoder"):
                    if key in alternative:
                        alternative["operation"] = alternative.get(key)
                        break
            alternative["operation"] = normalize_operation(alternative.get("operation"))
            alternative.setdefault("reason_not_selected", "")
            alternatives.append(alternative)
    return alternatives


class AgentDecision(BaseModel):
    """Canonical backend decision for operation-producing agents."""

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
            for key in ("action", "preferred_operation", "method", "scaler", "encoder", "imputer"):
                if key in normalized:
                    normalized["operation"] = normalized.get(key)
                    break

        normalized["operation"] = normalize_operation(normalized.get("operation"))
        normalized.setdefault("confidence", 0.75)
        normalized.setdefault("reason", "")
        normalized.setdefault("evidence", {})
        normalized.setdefault("alternatives_considered", [])
        normalized.setdefault("params", {})
        normalized.setdefault("requires_user_review", False)
        return normalized

    @field_validator("alternatives_considered", mode="before")
    @classmethod
    def normalize_alternatives_considered(cls, value: object) -> list[dict[str, Any]]:
        return normalize_alternatives(value)


class AgentDecisionBatch(BaseModel):
    """Model-facing compact batch, normalized to the internal contract."""

    agent_name: str = ""
    decisions: list[AgentDecision] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_output_shape(cls, value: object) -> object:
        if isinstance(value, list):
            return {"decisions": value, "warnings": []}
        if not isinstance(value, dict):
            return value

        if "decisions" in value or "operations" in value:
            decisions = value.get("decisions", value.get("operations", []))
            if isinstance(decisions, dict):
                decisions = _column_keyed_operation_decisions(decisions)
            return {
                "agent_name": value.get("agent_name", ""),
                "decisions": decisions or [],
                "warnings": value.get("warnings", []),
            }

        # Backward compatibility for column-keyed maps:
        # {"col_a": {"operation": "..."}, "col_b": "..."}
        decisions = _column_keyed_operation_decisions(value)
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
    """Canonical backend decision for ColumnRoleAgent."""

    column_name: str
    semantic_type: str
    recommended_role: Literal["feature", "target", "drop", "review"]
    risk_level: Literal["low", "medium", "high"]
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

        if "recommended_role" not in normalized and "role" in normalized:
            normalized["recommended_role"] = normalized.get("role")

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
            }.get(action, action)

        role = str(normalized.get("recommended_role", "")).strip().lower()
        if role:
            normalized["recommended_role"] = {
                "keep": "feature",
                "use": "feature",
                "input": "feature",
                "predictor": "feature",
                "label": "target",
                "y": "target",
                "remove": "drop",
                "ignore": "drop",
            }.get(role, role)

        semantic = str(normalized.get("semantic_type") or normalized.get("type") or "").strip().lower()
        semantic_aliases = {
            "id": "identifier",
            "identifier": "identifier",
            "numeric": "numeric_measure",
            "number": "numeric_measure",
            "numerical": "numeric_measure",
            "float": "numeric_measure",
            "integer": "numeric_measure",
            "int": "numeric_measure",
            "measure": "numeric_measure",
            "categorical": "categorical_feature",
            "category": "categorical_feature",
            "object": "categorical_feature",
            "boolean": "boolean_feature",
            "bool": "boolean_feature",
            "datetime": "datetime_feature",
            "date": "datetime_feature",
            "text": "free_text",
            "free_text": "free_text",
            "ordinal": "ordinal_feature",
            "target": "target",
        }
        if semantic:
            normalized["semantic_type"] = semantic_aliases.get(semantic, semantic)

        risk = str(normalized.get("risk_level", "")).strip().lower()
        if risk:
            normalized["risk_level"] = {
                "none": "low",
                "safe": "low",
                "minor": "low",
                "moderate": "medium",
                "med": "medium",
                "review": "medium",
                "risky": "high",
                "critical": "high",
            }.get(risk, risk)

        normalized.setdefault("confidence", 0.75)
        normalized.setdefault("reason", "")
        normalized.setdefault("evidence", {})
        return normalized


class ColumnRoleDecisionBatch(BaseModel):
    """Compact model-facing ColumnRole contract."""

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
            return {
                "agent_name": value.get("agent_name", "ColumnRoleAgent"),
                "decisions": value.get("decisions") or [],
                "warnings": value.get("warnings", []),
            }

        decisions: list[dict[str, Any]] = []
        for key, item in value.items():
            if key in _IGNORED_TOP_LEVEL_KEYS:
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


_IGNORED_TOP_LEVEL_KEYS = {
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
    "allowed_operations",
    "operation_null_meaning",
    "null_operation_meaning",
    "forbidden",
    "skill",
    "task",
}


def _column_keyed_operation_decisions(value: dict[str, Any]) -> list[dict[str, Any]]:
    decisions: list[dict[str, Any]] = []
    for key, item in value.items():
        if key in _IGNORED_TOP_LEVEL_KEYS:
            continue
        if isinstance(item, dict):
            decision = dict(item)
            decision.setdefault("column_name", key)
            decisions.append(decision)
            continue
        if isinstance(item, (str, type(None))):
            decisions.append({"column_name": key, "operation": item})
    return decisions
