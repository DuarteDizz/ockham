"""Models endpoint: list available ML models by problem type."""

from fastapi import APIRouter, HTTPException

from src.api.schemas.model import ModelItem, ModelListResponse
from src.ml.models.model_specs import PROBLEM_TYPES
from src.ml.models.registry import get_models_by_problem_type

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=ModelListResponse)
def get_models(problem_type: str) -> dict:
    if problem_type not in PROBLEM_TYPES:
        raise HTTPException(400, "Invalid problem_type.")

    models = [
        ModelItem(
            id=model["id"],
            name=model["name"],
            category=model["category"],
            problem_type=model["problem_type"],
        )
        for model in get_models_by_problem_type(problem_type)
    ]
    return {"problem_type": problem_type, "models": models}
