from src.ml.contracts import ModelSearchResult
from src.ml.score_ranker import make_score_sort_key, rank_models_by_score


def make_result(model_id: str, score: float, rmse: float = 0.0) -> ModelSearchResult:
    return ModelSearchResult(
        model_id=model_id,
        model_label=model_id,
        display_name=model_id,
        problem_type="regression",
        best_score=score,
        primary_metric="r2",
        metrics_mean={
            "r2": score,
            "neg_root_mean_squared_error": -rmse,
            "neg_mean_absolute_error": -(rmse / 2 if rmse else 0.0),
        },
        metrics_std={"r2": 0.01},
        search_params={},
        best_params={},
        capability_profile={},
        diagnostics={},
        raw_search=None,
    )


def test_make_score_sort_key_prefers_higher_r2_then_lower_error():
    better = make_result("better", 0.91, rmse=12.0)
    worse = make_result("worse", 0.84, rmse=10.0)

    assert make_score_sort_key(better) > make_score_sort_key(worse)


def test_rank_models_by_score_assigns_performance_rank():
    results = [make_result("b", 0.82, 14.0), make_result("a", 0.91, 12.0)]

    ranked = rank_models_by_score(results)

    assert [item.model_id for item in ranked] == ["a", "b"]
    assert ranked[0].performance_rank == 1
    assert ranked[1].performance_rank == 2
