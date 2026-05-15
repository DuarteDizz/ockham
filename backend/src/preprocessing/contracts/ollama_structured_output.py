"""Runtime helpers for Ollama native structured JSON output.

Ollama supports native structured outputs through the request-level ``format``
field. The schemas here are intentionally compact: local models only generate
the decision core, while the backend normalizes the result to Ockham's full
internal contract.
"""

from __future__ import annotations

from contextlib import contextmanager
from copy import deepcopy
from typing import Any, Iterator

from pydantic import BaseModel


_MISSING = object()

_COLUMN_ROLE_SEMANTIC_TYPES = [
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
]

_COLUMN_ROLE_RECOMMENDED_ROLES = ["feature", "target", "drop", "review"]
_COLUMN_ROLE_RISK_LEVELS = ["low", "medium", "high"]


def build_ollama_json_schema(
    output_model: type[BaseModel],
    *,
    expected_columns: list[str] | None = None,
) -> dict[str, Any]:
    """Return a JSON Schema suitable for Ollama's ``format`` parameter."""
    schema = deepcopy(output_model.model_json_schema())
    schema.pop("$schema", None)

    if expected_columns:
        _inject_column_name_enum(schema, expected_columns)

    return schema


def build_specialist_agent_json_schema(
    *,
    agent_name: str,
    expected_columns: list[str],
    allowed_operations: list[str] | None = None,
) -> dict[str, Any]:
    """Build compact schema for one preprocessing specialist batch."""
    if agent_name == "ColumnRoleAgent":
        return _build_column_role_schema(expected_columns=expected_columns)

    return _build_operation_agent_schema(
        expected_columns=expected_columns,
        allowed_operations=allowed_operations or [],
    )


def _build_column_role_schema(*, expected_columns: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["decisions"],
        "properties": {
            "agent_name": {"type": "string"},
            "decisions": {
                "type": "array",
                "minItems": len(expected_columns),
                "maxItems": len(expected_columns),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "column_name",
                        "semantic_type",
                        "recommended_role",
                        "risk_level",
                        "confidence",
                        "reason",
                        "evidence",
                    ],
                    "properties": {
                        "column_name": {"type": "string", "enum": list(expected_columns)},
                        "semantic_type": {"type": "string", "enum": _COLUMN_ROLE_SEMANTIC_TYPES},
                        "recommended_role": {"type": "string", "enum": _COLUMN_ROLE_RECOMMENDED_ROLES},
                        "risk_level": {"type": "string", "enum": _COLUMN_ROLE_RISK_LEVELS},
                        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "reason": {"type": "string"},
                        "evidence": {"type": "object", "additionalProperties": True},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    }


def _operation_value_schema(allowed_operations: list[str]) -> dict[str, Any]:
    operation_enum = list(dict.fromkeys(allowed_operations))
    return {"anyOf": [{"type": "string", "enum": operation_enum}, {"type": "null"}]}


def _build_operation_agent_schema(
    *,
    expected_columns: list[str],
    allowed_operations: list[str],
) -> dict[str, Any]:
    operation_schema = _operation_value_schema(allowed_operations)
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["decisions"],
        "properties": {
            "agent_name": {"type": "string"},
            "decisions": {
                "type": "array",
                "minItems": len(expected_columns),
                "maxItems": len(expected_columns),
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "column_name",
                        "operation",
                        "confidence",
                        "reason",
                        "evidence",
                    ],
                    "properties": {
                        "column_name": {"type": "string", "enum": list(expected_columns)},
                        "operation": operation_schema,
                        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                        "reason": {"type": "string"},
                        "evidence": {"type": "object", "additionalProperties": True},
                    },
                },
            },
            "warnings": {"type": "array", "items": {"type": "string"}},
        },
    }


def _inject_column_name_enum(node: Any, expected_columns: list[str]) -> None:
    if isinstance(node, dict):
        properties = node.get("properties")
        if isinstance(properties, dict):
            column_schema = properties.get("column_name")
            if isinstance(column_schema, dict):
                column_schema["enum"] = list(expected_columns)

        for value in node.values():
            _inject_column_name_enum(value, expected_columns)
        return

    if isinstance(node, list):
        for item in node:
            _inject_column_name_enum(item, expected_columns)


def _get_additional_args_container(model: Any) -> dict[str, Any] | None:
    """Return a mutable native-arguments dict for Strands OllamaModel."""
    args = getattr(model, "additional_args", None)
    if isinstance(args, dict):
        return args

    model_name = model.__class__.__name__.lower()
    if "ollama" not in model_name:
        return None

    try:
        setattr(model, "additional_args", {})
    except Exception:  # pragma: no cover - depends on Strands internals
        return None

    args = getattr(model, "additional_args", None)
    return args if isinstance(args, dict) else None


@contextmanager
def apply_ollama_structured_output_schema(
    model: Any,
    schema: dict[str, Any] | None,
) -> Iterator[None]:
    """Temporarily set Ollama native ``format`` for one invocation."""
    args = _get_additional_args_container(model)
    if args is None or schema is None:
        yield
        return

    previous_format = args.get("format", _MISSING)
    args["format"] = schema
    try:
        yield
    finally:
        if previous_format is _MISSING:
            args.pop("format", None)
        else:
            args["format"] = previous_format
