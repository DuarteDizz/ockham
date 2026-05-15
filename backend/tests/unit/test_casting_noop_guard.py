from src.preprocessing.profile_views.builder import ProfileViewBuilder
from src.preprocessing.services.plan_merger import merge_agent_decisions
from src.preprocessing.state import PreprocessingState


def make_profile():
    return {
        "row_count": 1000,
        "columns": [
            {
                "column_name": "Base_Fare",
                "raw_dtype": "float64",
                "inferred_type": "numeric",
                "common_stats": {
                    "missing_count": 0,
                    "missing_ratio": 0.0,
                    "unique_count": 500,
                    "unique_ratio": 0.5,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {"mean": 125.0, "median": 100.0},
                "type_inference": {"numeric_parse_ratio": 1.0, "datetime_parse_ratio": 0.0},
            },
            {
                "column_name": "fare_text",
                "raw_dtype": "object",
                "inferred_type": "numeric_like_text",
                "common_stats": {
                    "missing_count": 0,
                    "missing_ratio": 0.0,
                    "unique_count": 500,
                    "unique_ratio": 0.5,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {"avg_length": 5.0, "max_length": 7},
                "type_inference": {"numeric_parse_ratio": 1.0, "datetime_parse_ratio": 0.0},
            },
        ],
    }


def make_role_decisions():
    return {
        "agent_name": "ColumnRoleAgent",
        "decisions": [
            {
                "column_name": "Base_Fare",
                "semantic_type": "numeric_measure",
                "recommended_role": "feature",
                "risk_level": "low",
            },
            {
                "column_name": "fare_text",
                "semantic_type": "numeric_measure",
                "recommended_role": "feature",
                "risk_level": "low",
            },
        ],
    }


def test_casting_view_excludes_already_aligned_numeric_columns():
    state = PreprocessingState(dataset_id="dataset_1", dataset_profile=make_profile())
    state.column_role_decisions = make_role_decisions()

    columns = ProfileViewBuilder(state).for_casting()

    assert [column["column_name"] for column in columns] == ["fare_text"]
    assert columns[0]["inferred_type"] == "numeric_like_text"
    assert columns[0]["semantic_type"] == "numeric_measure"


def test_merger_drops_noop_cast_numeric_steps():
    plan = merge_agent_decisions(
        dataset_id="dataset_1",
        problem_type="regression",
        target_column=None,
        dataset_profile=make_profile(),
        column_role_decisions=make_role_decisions(),
        decision_batches=[
            {
                "agent_name": "CastingAgent",
                "decisions": [
                    {
                        "column_name": "Base_Fare",
                        "operation": "cast_numeric",
                        "stage": "casting",
                        "confidence": 0.9,
                        "reason": "Already numeric no-op that should be ignored.",
                        "evidence": {"inferred_type": "numeric", "effective_type": "numeric"},
                    },
                    {
                        "column_name": "fare_text",
                        "operation": "cast_numeric",
                        "stage": "casting",
                        "confidence": 0.9,
                        "reason": "Numeric values are stored as text.",
                        "evidence": {"inferred_type": "numeric_like_text", "numeric_parse_ratio": 1.0},
                    },
                ],
            }
        ],
    )

    by_name = {column["column_name"]: column for column in plan["columns"]}

    assert by_name["Base_Fare"]["steps"] == []
    assert [step["operation"] for step in by_name["fare_text"]["steps"]] == ["cast_numeric"]
