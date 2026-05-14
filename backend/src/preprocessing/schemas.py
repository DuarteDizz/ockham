from typing import Any, Literal

from pydantic import BaseModel, Field


PreprocessingStage = Literal[
    "casting",
    "column_action",
    "imputation",
    "datetime",
    "encoding",
    "scaling",
]

StepStatus = Literal[
    "recommended",
    "approved",
    "edited_by_user",
    "rejected",
    "invalid",
    "executed",
]

ColumnRole = Literal["feature", "target", "drop", "review"]


class PreprocessingStep(BaseModel):
    id: str | None = None
    operation: str
    stage: PreprocessingStage
    params: dict[str, Any] = Field(default_factory=dict)
    status: StepStatus = "recommended"
    source_agent: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    reason: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)
    requires_user_review: bool = False


class ColumnPreprocessingPlan(BaseModel):
    column_name: str
    raw_dtype: str | None = None
    inferred_type: str | None = None
    effective_type: str | None = None
    semantic_type: str | None = None
    role: ColumnRole = "feature"
    steps: list[PreprocessingStep] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PreprocessingPlan(BaseModel):
    dataset_id: str
    problem_type: str = "classification"
    target_column: str | None = None
    status: Literal["draft_agentic", "validated", "invalid", "executed"] = "draft_agentic"
    columns: list[ColumnPreprocessingPlan] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    graph_metadata: dict[str, Any] = Field(
        default_factory=lambda: {
            "layout_mode": "stage_based",
            "stages": [
                "input",
                "columns",
                "casting",
                "imputation",
                "datetime",
                "encoding",
                "scaling",
                "output",
            ],
        }
    )


class ValidationIssue(BaseModel):
    column_name: str | None = None
    operation: str | None = None
    severity: Literal["error", "warning"] = "error"
    message: str


class ValidationResult(BaseModel):
    is_valid: bool
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)
