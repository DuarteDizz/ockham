from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.db.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    file_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    rows: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[int] = mapped_column(Integer, nullable=False)
    column_names: Mapped[list] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    dataset_id: Mapped[str] = mapped_column(String, nullable=False)
    problem_type: Mapped[str] = mapped_column(String, nullable=False)
    target_column: Mapped[str] = mapped_column(String, nullable=False)
    selected_models: Mapped[list] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, nullable=False)
    training_state: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )


class ExperimentResult(Base):
    __tablename__ = "experiment_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    experiment_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    model_id: Mapped[str] = mapped_column(String, nullable=False)
    model_name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    problem_type: Mapped[str] = mapped_column(String, nullable=False)
    primary_metric: Mapped[str] = mapped_column(String, nullable=False)

    best_score: Mapped[float] = mapped_column(Float, nullable=False)

    best_params: Mapped[dict] = mapped_column(JSON, nullable=False)
    metrics_mean: Mapped[dict] = mapped_column(JSON, nullable=False)
    metrics_std: Mapped[dict] = mapped_column(JSON, nullable=False)
    structural_scores: Mapped[dict] = mapped_column(JSON, nullable=False)
    ockham_components: Mapped[dict] = mapped_column(JSON, nullable=False)

    fit_time_mean: Mapped[float] = mapped_column(Float, nullable=False)
    score_time_mean: Mapped[float] = mapped_column(Float, nullable=False)
    total_search_time: Mapped[float] = mapped_column(Float, nullable=False)
    inference_time_per_1000_rows: Mapped[float] = mapped_column(Float, nullable=False)

    performance_rank: Mapped[int] = mapped_column(Integer, nullable=False)
    ockham_rank: Mapped[int] = mapped_column(Integer, nullable=False)
    is_ockham_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False)

    cv_fold_scores: Mapped[dict] = mapped_column(JSON, nullable=False)
    confusion_matrix: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    roc_curve: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    learning_curve: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    validation_curve: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actual_vs_predicted: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    optuna_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )
