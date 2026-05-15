from src.preprocessing.profile_views.builder import ProfileViewBuilder
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
                    "total_count": 1000,
                    "observed_count": 1000,
                    "missing_count": 0,
                    "missing_ratio": 0.0,
                    "unique_count": 500,
                    "unique_ratio": 0.5,
                    "is_empty": False,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {
                    "mean": 125.0,
                    "median": 100.0,
                    "std": 55.0,
                    "variance": 3025.0,
                    "min": 10.0,
                    "max": 500.0,
                    "p01": 12.0,
                    "p05": 20.0,
                    "p25": 80.0,
                    "p50": 100.0,
                    "p75": 150.0,
                    "p95": 320.0,
                    "p99": 450.0,
                    "skewness": 1.8,
                    "kurtosis": 3.2,
                    "outlier_count_iqr": 30,
                    "outlier_ratio_iqr": 0.03,
                    "outlier_count_zscore": 5,
                    "outlier_ratio_zscore": 0.005,
                    "zero_ratio": 0.0,
                    "negative_ratio": 0.0,
                    "sparsity_score": 0.0,
                    "is_sparse": False,
                },
                "type_inference": {"numeric_parse_ratio": 1.0, "datetime_parse_ratio": 0.0},
            },
            {
                "column_name": "status",
                "raw_dtype": "object",
                "inferred_type": "text",
                "common_stats": {
                    "total_count": 1000,
                    "observed_count": 950,
                    "missing_count": 50,
                    "missing_ratio": 0.05,
                    "unique_count": 3,
                    "unique_ratio": 0.0032,
                    "is_empty": False,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {
                    "avg_length": 6.5,
                    "max_length": 12,
                    "top_1_ratio": 0.7,
                    "top_5_ratio": 1.0,
                    "rare_value_ratio": 0.0,
                    "normalized_entropy": 0.6,
                    "unique_pattern_count": 2,
                    "top_pattern_ratio": 0.9,
                },
                "type_inference": {"numeric_parse_ratio": 0.0, "datetime_parse_ratio": 0.0},
            },
            {
                "column_name": "fare_text",
                "raw_dtype": "object",
                "inferred_type": "numeric_like_text",
                "common_stats": {
                    "total_count": 1000,
                    "observed_count": 1000,
                    "missing_count": 0,
                    "missing_ratio": 0.0,
                    "unique_count": 500,
                    "unique_ratio": 0.5,
                    "is_empty": False,
                    "is_constant": False,
                    "is_mostly_missing": False,
                },
                "specific_stats": {"avg_length": 5.0, "max_length": 7},
                "type_inference": {"numeric_parse_ratio": 1.0, "datetime_parse_ratio": 0.0},
            },
        ],
    }


def make_state():
    state = PreprocessingState(dataset_id="dataset_1", dataset_profile=make_profile())
    state.column_role_decisions = {
        "agent_name": "ColumnRoleAgent",
        "decisions": [
            {
                "column_name": "Base_Fare",
                "semantic_type": "numeric_measure",
                "recommended_role": "feature",
                "risk_level": "low",
            },
            {
                "column_name": "status",
                "semantic_type": "categorical_feature",
                "recommended_role": "feature",
                "risk_level": "medium",
            },
            {
                "column_name": "fare_text",
                "semantic_type": "numeric_measure",
                "recommended_role": "feature",
                "risk_level": "low",
            },
        ],
    }
    return state


def by_name(columns):
    return {column["column_name"]: column for column in columns}


def test_column_role_view_exposes_common_counts_and_numeric_guardrail_fields():
    view = by_name(ProfileViewBuilder(make_state()).for_column_role())["Base_Fare"]

    for key in [
        "total_count",
        "observed_count",
        "is_empty",
        "min",
        "max",
        "zero_ratio",
        "negative_ratio",
    ]:
        assert key in view

    assert view["total_count"] == 1000
    assert view["observed_count"] == 1000
    assert view["min"] == 10.0


def test_casting_view_exposes_row_count_for_parse_and_cardinality_reasoning():
    view = by_name(ProfileViewBuilder(make_state()).for_casting())["fare_text"]

    assert view["row_count"] == 1000
    assert view["inferred_type"] == "numeric_like_text"
    assert view["numeric_parse_ratio"] == 1.0


def test_missing_values_view_exposes_role_risk_and_distribution_context():
    view = by_name(ProfileViewBuilder(make_state()).for_missing_values())["status"]

    for key in [
        "risk_level",
        "was_dropped",
        "is_mostly_missing",
        "top_5_ratio",
        "normalized_entropy",
        "avg_length",
        "max_length",
    ]:
        assert key in view

    assert view["risk_level"] == "medium"
    assert view["was_dropped"] is False
    assert view["top_5_ratio"] == 1.0


def test_encoding_view_exposes_row_count_and_text_pattern_context():
    view = by_name(ProfileViewBuilder(make_state()).for_encoding())["status"]

    for key in [
        "row_count",
        "was_dropped",
        "is_free_text_candidate",
        "unique_pattern_count",
        "top_pattern_ratio",
    ]:
        assert key in view

    assert view["row_count"] == 1000
    assert view["is_free_text_candidate"] is False
    assert view["unique_pattern_count"] == 2


def test_scaling_view_exposes_dtype_and_cardinality_guardrail_fields():
    view = by_name(ProfileViewBuilder(make_state()).for_scaling())["Base_Fare"]

    for key in ["raw_dtype", "inferred_type", "unique_count", "unique_ratio"]:
        assert key in view

    assert view["raw_dtype"] == "float64"
    assert view["inferred_type"] == "numeric"
    assert view["unique_count"] == 500
