from src.preprocessing.contracts.agent_decision import ColumnRoleDecision, ColumnRoleDecisionBatch
from src.preprocessing.contracts.ollama_structured_output import build_specialist_agent_json_schema


def test_column_role_schema_does_not_use_operation_contract_fields():
    schema = build_specialist_agent_json_schema(
        agent_name="ColumnRoleAgent",
        expected_columns=["a", "b"],
    )

    decision_schema = schema["properties"]["decisions"]["items"]
    properties = decision_schema["properties"]

    assert "recommended_role" in properties
    assert "semantic_type" in properties
    assert "risk_level" in properties
    assert "operation" not in properties
    assert "params" not in properties
    assert "requires_user_review" not in properties
    assert decision_schema["additionalProperties"] is False


def test_operation_agent_schema_does_not_use_column_role_contract_fields():
    schema = build_specialist_agent_json_schema(
        agent_name="ScalingAgent",
        expected_columns=["x"],
        allowed_operations=["standard_scaler", "robust_scaler"],
    )

    decision_schema = schema["properties"]["decisions"]["items"]
    properties = decision_schema["properties"]

    assert "operation" in properties
    assert "params" in properties
    assert "requires_user_review" in properties
    assert "recommended_role" not in properties
    assert "semantic_type" not in properties
    assert decision_schema["additionalProperties"] is False


def test_column_role_decision_accepts_role_alias():
    decision = ColumnRoleDecision.model_validate(
        {
            "column_name": "x",
            "role": "feature",
            "semantic_type": "numeric_measure",
            "risk_level": "low",
        }
    )

    assert decision.recommended_role == "feature"


def test_column_role_batch_rejects_operation_only_shape():
    try:
        ColumnRoleDecisionBatch.model_validate(
            {
                "agent_name": "ColumnRoleAgent",
                "decisions": [
                    {
                        "column_name": "x",
                        "operation": None,
                        "confidence": 0.9,
                        "reason": "wrong contract",
                        "evidence": {},
                    }
                ],
                "warnings": [],
            }
        )
    except Exception:
        return

    raise AssertionError("ColumnRoleDecisionBatch should reject operation-agent decision shapes")
