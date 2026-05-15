from src.preprocessing.contracts.agent_decision import AgentDecisionBatch, ColumnRoleDecisionBatch
from src.preprocessing.contracts.ollama_structured_output import build_specialist_agent_json_schema


def test_operation_batch_accepts_compact_contract_without_metadata():
    payload = AgentDecisionBatch.model_validate(
        {
            "decisions": [
                {
                    "column_name": "fare",
                    "operation": "median_imputer",
                    "confidence": 0.91,
                    "reason": "Skewed numeric feature.",
                    "evidence": {"skewness": 2.1},
                }
            ]
        }
    ).model_dump()

    assert payload["agent_name"] == ""
    assert payload["warnings"] == []
    assert payload["decisions"][0]["params"] == {}
    assert payload["decisions"][0]["alternatives_considered"] == []
    assert payload["decisions"][0]["requires_user_review"] is False


def test_operation_batch_accepts_operations_alias_and_string_alternatives():
    payload = AgentDecisionBatch.model_validate(
        {
            "operations": [
                {
                    "column_name": "fare",
                    "operation": "mean_imputer",
                    "confidence": 0.8,
                    "reason": "Low skew.",
                    "evidence": {"skewness": 0.1},
                    "alternatives_considered": ["median_imputer"],
                }
            ]
        }
    ).model_dump()

    assert payload["decisions"][0]["column_name"] == "fare"
    assert payload["decisions"][0]["alternatives_considered"][0]["operation"] == "median_imputer"


def test_column_role_batch_accepts_compact_contract_without_metadata():
    payload = ColumnRoleDecisionBatch.model_validate(
        {
            "decisions": [
                {
                    "column_name": "target",
                    "semantic_type": "numeric",
                    "recommended_role": "label",
                    "risk_level": "safe",
                    "confidence": 0.9,
                    "reason": "Marked target.",
                    "evidence": {"is_target": True},
                }
            ]
        }
    ).model_dump()

    decision = payload["decisions"][0]
    assert payload["agent_name"] == "ColumnRoleAgent"
    assert payload["warnings"] == []
    assert decision["semantic_type"] == "numeric_measure"
    assert decision["recommended_role"] == "target"
    assert decision["risk_level"] == "low"


def test_ollama_operation_schema_requires_only_core_decision_fields():
    schema = build_specialist_agent_json_schema(
        agent_name="MissingValueAgent",
        expected_columns=["a"],
        allowed_operations=["mean_imputer", "median_imputer"],
    )
    decision_schema = schema["properties"]["decisions"]["items"]

    assert schema["required"] == ["decisions"]
    assert set(decision_schema["required"]) == {"column_name", "operation", "confidence", "reason", "evidence"}
    assert "params" not in decision_schema["properties"]
    assert "alternatives_considered" not in decision_schema["properties"]


def test_ollama_column_role_schema_uses_classification_fields_only():
    schema = build_specialist_agent_json_schema(
        agent_name="ColumnRoleAgent",
        expected_columns=["a"],
    )
    decision_schema = schema["properties"]["decisions"]["items"]

    assert schema["required"] == ["decisions"]
    assert "semantic_type" in decision_schema["properties"]
    assert "recommended_role" in decision_schema["properties"]
    assert "operation" not in decision_schema["properties"]
