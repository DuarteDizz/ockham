from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.preprocessing.operation_registry import get_operation_registry_payload
from src.preprocessing.profile_service import DatasetProfileService
from src.preprocessing.services.agentic_plan_service import AgenticPreprocessingPlanService

router = APIRouter(prefix="/datasets", tags=["preprocessing"])
registry_router = APIRouter(prefix="/preprocessing", tags=["preprocessing"])


class AgenticPlanRequest(BaseModel):
    problem_type: str = "classification"
    target_column: str | None = None


@registry_router.get("/operations")
def get_preprocessing_operations() -> dict:
    """Return the canonical preprocessing operation registry for the UI."""
    return get_operation_registry_payload()


@router.get("/{dataset_id}/profile")
def get_dataset_profile(dataset_id: str) -> dict:
    """Return deterministic, backend-computed column profile data for the UI."""
    service = DatasetProfileService()
    return service.compute_dataset_profile(dataset_id)


@router.post("/{dataset_id}/preprocessing/agent-plan")
async def create_agentic_preprocessing_plan(
    dataset_id: str,
    request: AgenticPlanRequest,
) -> dict:
    service = AgenticPreprocessingPlanService()

    return await service.create_agentic_plan(
        dataset_id=dataset_id,
        problem_type=request.problem_type,
        target_column=request.target_column,
    )


@router.post("/{dataset_id}/preprocessing/agent-plan/stream")
async def stream_agentic_preprocessing_plan(
    dataset_id: str,
    request: AgenticPlanRequest,
) -> StreamingResponse:
    service = AgenticPreprocessingPlanService()

    return StreamingResponse(
        service.stream_agentic_plan(
            dataset_id=dataset_id,
            problem_type=request.problem_type,
            target_column=request.target_column,
        ),
        media_type="application/x-ndjson",
    )
