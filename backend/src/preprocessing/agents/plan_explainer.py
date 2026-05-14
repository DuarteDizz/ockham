import json
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field, field_validator
from strands import Agent
from strands.agent import AgentResult
from strands.models import Model
from strands.multiagent.base import MultiAgentBase, MultiAgentResult, NodeResult, Status
from strands.telemetry.metrics import EventLoopMetrics
from strands.types.content import ContentBlock, Message

from ..prompts import plan_explainer_prompt
from ..operation_registry import normalize_string_list
from ..services.plan_serializer import summarize_plan
from ..state import PreprocessingState


class ColumnExplanation(BaseModel):
    column_name: str
    explanation: str


class PlanExplainerOutput(BaseModel):
    summary: str = ""
    column_explanations: list[ColumnExplanation] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @field_validator("warnings", mode="before")
    @classmethod
    def normalize_warnings(cls, value: object) -> list[str]:
        return normalize_string_list(value)


class PlanExplainerAgent(MultiAgentBase):
    """Explain the approved preprocessing plan for the frontend."""

    def __init__(
        self,
        state: PreprocessingState,
        name: str,
        model: Model,
        description: str,
        system_prompt: str = "",
    ):
        super().__init__()
        self.state = state
        system_prompt = plan_explainer_prompt
        self.executor = Agent(
            name=name,
            model=model,
            description=description,
            system_prompt=system_prompt,
        )

    def build_task(self) -> str:
        plan = self.state.final_plan or self.state.merged_plan
        payload = {
            "dataset_id": self.state.dataset_id,
            "target_column": self.state.target_column,
            "plan_summary": summarize_plan(plan),
            "plan": plan,
            "validation_result": self.state.validation_result,
            "judge_reason": self.state.judge_reason,
        }
        return json.dumps(payload, ensure_ascii=False, indent=2)

    async def invoke_async(
        self,
        task: str | list[ContentBlock],
        invocation_state: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MultiAgentResult:
        task = self.build_task()
        result = AgentResult(
            stop_reason="end_turn",
            message=Message(role="assistant", content=[{"text": "Agent not executed."}]),
            metrics=EventLoopMetrics(),
            state="failed",
        )

        result = await self.executor.invoke_async(task, structured_output_model=PlanExplainerOutput)
        output: PlanExplainerOutput = result.structured_output
        self.state.explanation = output.model_dump()

        if result.state == "failed":
            logger.error("Plan explainer agent failed to run.")
            raise ValueError(f"Agent {self.executor.name} failed to run")

        logger.debug("Plan explainer agent completed successfully.")
        return MultiAgentResult(
            status=Status.COMPLETED,
            results={self.executor.name: NodeResult(result=result)},
        )
