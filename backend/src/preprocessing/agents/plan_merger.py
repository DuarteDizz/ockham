from typing import Any

from loguru import logger
from strands.agent import AgentResult
from strands.multiagent.base import MultiAgentBase, MultiAgentResult, NodeResult, Status
from strands.telemetry.metrics import EventLoopMetrics
from strands.types.content import ContentBlock, Message

from ..services.plan_merger import merge_agent_decisions
from ..services.plan_validator import validate_preprocessing_plan
from ..state import PreprocessingState


class PlanMergerAgent(MultiAgentBase):
    """Merge specialist decisions and run deterministic plan validation."""

    def __init__(self, state: PreprocessingState, name: str, description: str):
        super().__init__()
        self.state = state
        self.name = name
        self.description = description

    def merge_plan(self) -> dict[str, Any]:
        plan = merge_agent_decisions(
            dataset_id=self.state.dataset_id,
            problem_type=self.state.problem_type,
            target_column=self.state.target_column,
            dataset_profile=self.state.dataset_profile,
            column_role_decisions=self.state.column_role_decisions,
            decision_batches=[
                self.state.casting_decisions,
                self.state.feature_drop_decisions,
                self.state.missing_value_decisions,
                self.state.datetime_decisions,
                self.state.encoding_decisions,
                self.state.scaling_decisions,
            ],
        )
        self.state.merged_plan = plan
        self.state.validation_result = validate_preprocessing_plan(plan)
        return plan

    async def invoke_async(
        self,
        task: str | list[ContentBlock],
        invocation_state: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> MultiAgentResult:
        plan = self.merge_plan()
        message_text = f"Merged preprocessing plan with {len(plan.get('columns', []))} column(s)."

        result = AgentResult(
            stop_reason="end_turn",
            message=Message(role="assistant", content=[ContentBlock(text=message_text)]),
            metrics=EventLoopMetrics(),
            state="completed",
        )

        logger.debug("Plan merger completed successfully.")
        return MultiAgentResult(
            status=Status.COMPLETED,
            results={self.name: NodeResult(status=Status.COMPLETED, result=result)},
        )
