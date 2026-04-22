from pydantic import BaseModel


class ExperimentCreateRequest(BaseModel):
    dataset_id: str
    problem_type: str
    target_column: str
    selected_models: list[str]


class ExperimentResponse(BaseModel):
    experiment_id: str
    dataset_id: str
    problem_type: str
    target_column: str
    selected_models: list[str]
    status: str
    progress: int
    training_state: list[dict] | None = None
    live_step: str | None = None
    live_message: str | None = None
    started_at: str | None = None
