from pydantic import BaseModel, Field


class ExperimentResultItem(BaseModel):
    model_id: str
    model_name: str
    category: str
    problem_type: str
    primary_metric: str
    best_score: float
    best_params: dict
    metrics_mean: dict
    metrics_std: dict
    fit_time_mean: float
    total_search_time: float
    inference_time_per_1000_rows: float
    performance_rank: int
    ockham_rank: int
    is_ockham_recommended: bool
    cv_fold_scores: dict = Field(default_factory=dict)
    ockham_components: dict = Field(default_factory=dict)
    capability_profile: dict | None = None
    embedded_diagnostics: dict | None = None


class ExperimentResultsResponse(BaseModel):
    experiment_id: str
    ranking_mode: str
    ranking_provider: str | None = None
    ranking_error: str | None = None
    results: list[ExperimentResultItem]


class ExperimentModelDiagnosticsResponse(BaseModel):
    experiment_id: str
    model_id: str
    primary_metric: str
    cv_fold_scores: dict = Field(default_factory=dict)
    confusion_matrix: dict | None = None
    roc_curve: dict | None = None
    learning_curve: dict | None = None
    validation_curve: dict | None = None
    actual_vs_predicted: dict | None = None
    available_validation_params: list[str] = Field(default_factory=list)
    selected_validation_param: str | None = None
