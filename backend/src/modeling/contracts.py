from dataclasses import asdict, dataclass, field


def normalize_metric_map(values):
    if values is None:
        return {}

    normalized = {}

    for key, value in values.items():
        normalized[str(key)] = float(value)

    return normalized


def normalize_fold_scores(values):
    if values is None:
        return {}

    normalized = {}

    for key, fold_values in values.items():
        normalized[str(key)] = [float(value) for value in fold_values if value is not None]

    return normalized


def filter_payload_fields(dataclass_type, payload):
    if payload is None:
        return {}

    allowed_keys = set(dataclass_type.__dataclass_fields__.keys())
    normalized_payload = {}

    for key, value in dict(payload).items():
        if key in allowed_keys:
            normalized_payload[key] = value

    return normalized_payload


@dataclass
class ModelSearchResult:
    model_id: str
    model_name: str
    category: str
    problem_type: str
    primary_metric: str
    best_score: float
    best_params: dict = field(default_factory=dict)
    metrics_mean: dict = field(default_factory=dict)
    metrics_std: dict = field(default_factory=dict)
    fit_time_mean: float = 0.0
    score_time_mean: float = 0.0
    total_search_time: float = 0.0
    inference_time_per_1000_rows: float = 0.0
    cv_folds: int = 0
    n_iter: int = 0
    optuna: dict = field(default_factory=dict)
    structural_scores: dict = field(default_factory=dict)
    cv_fold_scores: dict = field(default_factory=dict)
    confusion_matrix: dict | None = None
    roc_curve: dict | None = None
    learning_curve: dict | None = None
    validation_curve: dict | None = None
    actual_vs_predicted: dict | None = None
    performance_rank: int = 0

    def __post_init__(self):
        self.best_score = float(self.best_score)
        self.best_params = dict(self.best_params) if self.best_params is not None else {}
        self.metrics_mean = normalize_metric_map(self.metrics_mean)
        self.metrics_std = normalize_metric_map(self.metrics_std)
        self.fit_time_mean = float(self.fit_time_mean)
        self.score_time_mean = float(self.score_time_mean)
        self.total_search_time = float(self.total_search_time)
        self.inference_time_per_1000_rows = float(self.inference_time_per_1000_rows)
        self.cv_folds = int(self.cv_folds)
        self.n_iter = int(self.n_iter)
        self.optuna = dict(self.optuna) if self.optuna is not None else {}

        structural_scores = self.structural_scores if self.structural_scores is not None else {}
        self.structural_scores = {
            str(key): float(value) for key, value in structural_scores.items()
        }
        self.cv_fold_scores = normalize_fold_scores(self.cv_fold_scores)
        self.performance_rank = (
            int(self.performance_rank) if self.performance_rank is not None else 0
        )

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_payload(cls, payload):
        return cls(**filter_payload_fields(cls, payload))


@dataclass
class ScoreContext:
    score_leader_model_id: str | None
    score_leader_model_name: str | None
    best_score: float
    performance_rank: int
    score_gap_to_leader: float
    score_gap_ratio: float


@dataclass
class PrimaryMetricEvidence:
    metric_name: str
    mean: float
    std: float
    normalized_against_peers: float
    higher_is_better: bool = True


@dataclass
class PerformanceEvidence:
    primary_metric: PrimaryMetricEvidence
    metrics_mean: dict = field(default_factory=dict)
    metrics_std: dict = field(default_factory=dict)
    cv_folds: int = 0
    cv_primary_fold_scores: list = field(default_factory=list)

    def __post_init__(self):
        self.metrics_mean = normalize_metric_map(self.metrics_mean)
        self.metrics_std = normalize_metric_map(self.metrics_std)
        self.cv_folds = int(self.cv_folds)
        self.cv_primary_fold_scores = [float(value) for value in self.cv_primary_fold_scores]


@dataclass
class StructuralProfile:
    simplicity: float
    interpretability: float
    scalability: float

    def __post_init__(self):
        self.simplicity = float(self.simplicity)
        self.interpretability = float(self.interpretability)
        self.scalability = float(self.scalability)


@dataclass
class ExecutionProfile:
    stability: float
    feature_efficiency: float
    training_efficiency: float
    inference_efficiency: float
    operational_efficiency: float

    def __post_init__(self):
        self.stability = float(self.stability)
        self.feature_efficiency = float(self.feature_efficiency)
        self.training_efficiency = float(self.training_efficiency)
        self.inference_efficiency = float(self.inference_efficiency)
        self.operational_efficiency = float(self.operational_efficiency)


@dataclass
class FeatureUsageContext:
    used_feature_count: float
    used_feature_ratio: float
    relative_count_efficiency: float
    relative_ratio_efficiency: float
    expanded_feature_count: float
    total_feature_count: float

    def __post_init__(self):
        self.used_feature_count = float(self.used_feature_count)
        self.used_feature_ratio = float(self.used_feature_ratio)
        self.relative_count_efficiency = float(self.relative_count_efficiency)
        self.relative_ratio_efficiency = float(self.relative_ratio_efficiency)
        self.expanded_feature_count = float(self.expanded_feature_count)
        self.total_feature_count = float(self.total_feature_count)


@dataclass
class OperationalContext:
    fit_time_mean: float
    score_time_mean: float
    total_search_time: float
    inference_time_per_1000_rows: float

    def __post_init__(self):
        self.fit_time_mean = float(self.fit_time_mean)
        self.score_time_mean = float(self.score_time_mean)
        self.total_search_time = float(self.total_search_time)
        self.inference_time_per_1000_rows = float(self.inference_time_per_1000_rows)


@dataclass
class OckhamEvidenceItem:
    result: ModelSearchResult
    score_context: ScoreContext
    performance_evidence: PerformanceEvidence
    structural_profile: StructuralProfile
    execution_profile: ExecutionProfile
    feature_usage_context: FeatureUsageContext
    operational_context: OperationalContext

    def to_dict(self):
        payload = self.result.to_dict()
        payload["score_context"] = asdict(self.score_context)
        payload["performance_evidence"] = asdict(self.performance_evidence)
        payload["structural_profile"] = asdict(self.structural_profile)
        payload["execution_profile"] = asdict(self.execution_profile)
        payload["feature_usage_context"] = asdict(self.feature_usage_context)
        payload["operational_context"] = asdict(self.operational_context)
        payload["ockham_components"] = {
            "score_context": payload["score_context"],
            "performance_evidence": payload["performance_evidence"],
            "structural_profile": payload["structural_profile"],
            "execution_profile": payload["execution_profile"],
            "feature_usage_context": payload["feature_usage_context"],
            "operational_context": payload["operational_context"],
        }
        payload["cv_primary_fold_scores"] = list(self.performance_evidence.cv_primary_fold_scores)
        return payload
