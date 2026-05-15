def read_metric(result, metric_name, default=None):
    value = result.metrics_mean.get(metric_name, default)
    if value is None:
        return default

    if metric_name.startswith("neg_"):
        return abs(value)

    return value


def read_primary_metric_std(result):
    primary_metric = str(result.primary_metric or "")
    value = result.metrics_std.get(primary_metric, 0.0)
    return abs(value or 0.0)


def make_score_sort_key(result):
    if result.problem_type == "regression":
        r2 = read_metric(result, "r2", result.best_score)
        rmse = read_metric(result, "neg_root_mean_squared_error", 0.0)
        mae = read_metric(result, "neg_mean_absolute_error", 0.0)
        return (r2, -rmse, -mae, -read_primary_metric_std(result))

    accuracy = read_metric(result, "accuracy", result.best_score)
    f1_weighted = read_metric(result, "f1_weighted", result.best_score)
    roc_auc = read_metric(result, "roc_auc", 0.0)
    return (result.best_score, accuracy, f1_weighted, roc_auc, -read_primary_metric_std(result))


def rank_models_by_score(results):
    ranked_results = list(results)
    ranked_results.sort(key=make_score_sort_key, reverse=True)

    for performance_rank, result in enumerate(ranked_results, start=1):
        result.performance_rank = performance_rank

    return ranked_results
