from pydantic import BaseModel, Field


class OptunaBestTrialPayload(BaseModel):
    number: int | None = None
    value: float | None = None
    params: dict = Field(default_factory=dict)
    metrics_mean: dict = Field(default_factory=dict)
    metrics_std: dict = Field(default_factory=dict)
    cv_fold_scores: dict = Field(default_factory=dict)
    fit_time_mean: float | None = None
    score_time_mean: float | None = None
    train_validation_summary: dict = Field(default_factory=dict)
    selected_search_space_index: int | None = None


class OptunaPayload(BaseModel):
    search_backend: str
    best_value: float | None = None
    best_params: dict = Field(default_factory=dict)
    duration_seconds: float | None = None
    n_trials: int | None = None
    search_space: dict | list[dict] | None = None
    best_trial: OptunaBestTrialPayload | None = None
    trial_history: list[dict] = Field(default_factory=list)


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
    score_context: dict = Field(default_factory=dict)
    performance_evidence: dict = Field(default_factory=dict)
    structural_profile: dict = Field(default_factory=dict)
    execution_profile: dict = Field(default_factory=dict)
    feature_usage_context: dict = Field(default_factory=dict)
    operational_context: dict = Field(default_factory=dict)
    fit_time_mean: float
    total_search_time: float
    inference_time_per_1000_rows: float
    performance_rank: int
    ockham_rank: int
    is_ockham_recommended: bool
    cv_fold_scores: dict = Field(default_factory=dict)
    ockham_components: dict = Field(default_factory=dict)
    optuna: OptunaPayload | None = None
    capability_profile: dict | None = None
    embedded_diagnostics: dict | None = None


class ExperimentResultsResponse(BaseModel):
    experiment_id: str
    ranking_mode: str
    ranking_provider: str | None = None
    ranking_status: str | None = None
    ranking_error: str | None = None
    results: list[ExperimentResultItem]


class ExperimentModelDiagnosticsResponse(BaseModel):
    experiment_id: str
    model_id: str
    model_name: str
    category: str
    problem_type: str
    primary_metric: str
    best_score: float
    best_params: dict
    score_context: dict = Field(default_factory=dict)
    performance_evidence: dict = Field(default_factory=dict)
    structural_profile: dict = Field(default_factory=dict)
    execution_profile: dict = Field(default_factory=dict)
    feature_usage_context: dict = Field(default_factory=dict)
    operational_context: dict = Field(default_factory=dict)
    optuna: OptunaPayload | None = None
    capability_profile: dict | None = None
    available_validation_params: list[str] = Field(default_factory=list)
    selected_validation_param: str | None = None
    cv_fold_scores: dict
    confusion_matrix: dict | None = None
    roc_curve: dict | None = None
    learning_curve: dict | None = None
    validation_curve: dict | None = None
    actual_vs_predicted: dict | None = None
