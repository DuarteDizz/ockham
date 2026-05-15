import json
from collections.abc import AsyncIterator
from typing import Any

from loguru import logger

try:
    from src.preprocessing.profile_service import DatasetProfileService
except ModuleNotFoundError:  # pragma: no cover - supports future profiling package layout.
    from src.preprocessing.profiling.profile_service import DatasetProfileService

from src.preprocessing.core import build_preprocessing_graph_pipeline
from src.preprocessing.pipeline import PreprocessingPipelineSession
from src.preprocessing.state import PreprocessingState


class AgenticPreprocessingPlanService:
    """Create an agentic preprocessing plan from deterministic profiling."""

    def __init__(self) -> None:
        self.profile_service = DatasetProfileService()

    def _build_session(
        self,
        *,
        dataset_id: str,
        problem_type: str,
        target_column: str | None,
    ) -> PreprocessingPipelineSession:
        dataset_profile = self.profile_service.compute_dataset_profile(dataset_id)

        state = PreprocessingState(
            dataset_id=dataset_id,
            problem_type=problem_type,
            target_column=target_column,
            dataset_profile=dataset_profile,
        )

        graph, state = build_preprocessing_graph_pipeline(state)
        return PreprocessingPipelineSession(graph=graph, state=state)

    async def create_agentic_plan(
        self,
        dataset_id: str,
        problem_type: str,
        target_column: str | None,
    ) -> dict:
        logger.info("Creating agentic preprocessing plan for dataset_id={}", dataset_id)

        session = self._build_session(
            dataset_id=dataset_id,
            problem_type=problem_type,
            target_column=target_column,
        )

        events: list[dict[str, Any]] = []
        async for event in session.iter_events_async():
            safe_event = dict(event)
            safe_event.pop("raw_result", None)
            events.append(safe_event)

        final_plan = session.state.final_plan or session.state.merged_plan

        return {
            "dataset_id": dataset_id,
            "problem_type": problem_type,
            "target_column": target_column,
            "status": "agentic_draft",
            "plan": final_plan,
            "validation_result": session.state.validation_result,
            "events": events,
        }

    async def stream_agentic_plan(
        self,
        dataset_id: str,
        problem_type: str,
        target_column: str | None,
    ) -> AsyncIterator[str]:
        logger.info("Streaming agentic preprocessing plan for dataset_id={}", dataset_id)

        yield self._to_ndjson(
            {
                "kind": "run_started",
                "message": "Starting agentic preprocessing recommendation.",
            }
        )

        try:
            session = self._build_session(
                dataset_id=dataset_id,
                problem_type=problem_type,
                target_column=target_column,
            )

            async for event in session.iter_events_async():
                safe_event = dict(event)
                safe_event.pop("raw_result", None)
                yield self._to_ndjson(safe_event)

        except Exception as error:
            logger.exception("Agentic preprocessing stream failed.")
            yield self._to_ndjson(
                {
                    "kind": "error",
                    "message": self._friendly_error_message(error),
                }
            )

    def _friendly_error_message(self, error: Exception) -> str:
        raw_message = str(error)
        if "model" in raw_message.lower() and "not found" in raw_message.lower():
            return (
                "The configured Ollama model was not found. Pull the model locally "
                "or select another available model in LLM settings."
            )
        if "404" in raw_message and "11434" in raw_message:
            return (
                "Ollama returned 404 for the configured model. Check the model name "
                "with `ollama list` and update the Ockham LLM settings."
            )
        return "The agentic preprocessing flow failed. Check backend logs for details."

    def _to_ndjson(self, payload: dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=False, default=str) + "\n"
