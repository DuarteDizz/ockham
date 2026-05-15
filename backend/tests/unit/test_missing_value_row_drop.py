from src.preprocessing.profile_views.builder import ProfileViewBuilder
from src.preprocessing.services.plan_merger import merge_agent_decisions
from src.preprocessing.services.plan_validator import validate_preprocessing_plan
from src.preprocessing.state import PreprocessingState


def make_profile():
    return {
        "row_count": 2000,
        "columns": [
            {
                "column_name": "target",
                "raw_dtype": "float64",
                "inferred_type": "numeric",
                "common_stats": {
                    "missing_count": 10,
                    "missing_ratio": 0.005,
                    "unique_count": 2,
                    "unique_ratio": 0.001,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {"mean": 0.5, "median": 1.0, "skewness": 0.1},
            },
            {
                "column_name": "age",
                "raw_dtype": "float64",
                "inferred_type": "numeric",
                "common_stats": {
                    "missing_count": 4,
                    "missing_ratio": 0.002,
                    "unique_count": 70,
                    "unique_ratio": 0.035,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {"mean": 43.0, "median": 41.0, "skewness": 0.2},
            },
        ],
    }


def test_missing_value_view_includes_target_with_missing_labels():
    state = PreprocessingState(
        dataset_id="dataset_1",
        problem_type="classification",
        target_column="target",
        dataset_profile=make_profile(),
    )
    state.column_role_decisions = {
        "agent_name": "ColumnRoleAgent",
        "decisions": [
            {
                "column_name": "target",
                "semantic_type": "target",
                "recommended_role": "target",
                "risk_level": "low",
            },
            {
                "column_name": "age",
                "semantic_type": "numeric_measure",
                "recommended_role": "feature",
                "risk_level": "low",
            },
        ],
    }

    columns = ProfileViewBuilder(state).for_missing_values()

    assert {column["column_name"] for column in columns} == {"target", "age"}
    target_payload = next(column for column in columns if column["column_name"] == "target")
    assert target_payload["is_target"] is True


def test_merger_preserves_target_row_drop_but_removes_target_imputation():
    profile = make_profile()
    role_decisions = {
        "agent_name": "ColumnRoleAgent",
        "decisions": [
            {
                "column_name": "target",
                "semantic_type": "target",
                "recommended_role": "target",
                "risk_level": "low",
            },
            {
                "column_name": "age",
                "semantic_type": "numeric_measure",
                "recommended_role": "feature",
                "risk_level": "low",
            },
        ],
    }
    missing_decisions = {
        "agent_name": "MissingValueAgent",
        "decisions": [
            {
                "column_name": "target",
                "operation": "drop_rows_missing",
                "stage": "imputation",
                "params": {"scope": "missing_in_column"},
                "confidence": 0.88,
                "reason": "Missing target labels should be removed instead of imputed.",
                "evidence": {"missing_ratio": 0.005, "missing_count": 10, "row_count": 2000},
            },
            {
                "column_name": "target",
                "operation": "median_imputer",
                "stage": "imputation",
                "confidence": 0.2,
                "reason": "Invalid target imputation should not survive merging.",
                "evidence": {"missing_ratio": 0.005},
            },
            {
                "column_name": "age",
                "operation": "mean_imputer",
                "stage": "imputation",
                "confidence": 0.8,
                "reason": "Regular numeric distribution.",
                "evidence": {"missing_ratio": 0.002, "missing_count": 4, "row_count": 2000},
            },
        ],
    }

    plan = merge_agent_decisions(
        dataset_id="dataset_1",
        problem_type="classification",
        target_column="target",
        dataset_profile=profile,
        column_role_decisions=role_decisions,
        decision_batches=[missing_decisions],
    )

    target_plan = next(column for column in plan["columns"] if column["column_name"] == "target")
    assert target_plan["role"] == "target"
    assert [step["operation"] for step in target_plan["steps"]] == ["drop_rows_missing"]

    validation = validate_preprocessing_plan(plan)
    assert validation["is_valid"] is True


def test_validator_rejects_target_imputation_but_allows_target_row_drop():
    plan = {
        "dataset_id": "dataset_1",
        "problem_type": "classification",
        "target_column": "target",
        "columns": [
            {
                "column_name": "target",
                "role": "target",
                "effective_type": "numeric",
                "steps": [
                    {
                        "operation": "median_imputer",
                        "stage": "imputation",
                        "evidence": {"missing_ratio": 0.01},
                    }
                ],
            },
            {"column_name": "age", "role": "feature", "effective_type": "numeric", "steps": []},
        ],
    }

    invalid = validate_preprocessing_plan(plan)
    assert invalid["is_valid"] is False

    plan["columns"][0]["steps"] = [
        {
            "operation": "drop_rows_missing",
            "stage": "imputation",
            "params": {"scope": "missing_in_column"},
            "evidence": {"missing_ratio": 0.01},
        }
    ]
    valid = validate_preprocessing_plan(plan)
    assert valid["is_valid"] is True
