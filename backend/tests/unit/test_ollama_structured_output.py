from pydantic import BaseModel

from src.preprocessing.contracts.agent_decision import AgentDecisionBatch
from src.preprocessing.contracts.ollama_structured_output import (
    apply_ollama_structured_output_schema,
    build_ollama_json_schema,
)


class DummyOllamaModel:
    def __init__(self):
        self.additional_args = {"think": False, "format": "json"}


def test_build_schema_injects_expected_column_enum():
    schema = build_ollama_json_schema(
        AgentDecisionBatch,
        expected_columns=["a", "b"],
    )

    serialized = str(schema)
    assert "'enum': ['a', 'b']" in serialized or '"enum": ["a", "b"]' in serialized


def test_structured_output_schema_context_restores_previous_format():
    model = DummyOllamaModel()
    schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}}

    with apply_ollama_structured_output_schema(model, schema):
        assert model.additional_args["format"] == schema
        assert model.additional_args["think"] is False

    assert model.additional_args["format"] == "json"
