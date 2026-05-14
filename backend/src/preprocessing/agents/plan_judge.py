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


from ..prompts import plan_judge_prompt
from ..operation_registry import normalize_string_list
from ..services.plan_validator import validate_preprocessing_plan
from ..state import PreprocessingState


class PlanJudgeOutput(BaseModel):
    decision: str = ""
    reason: str = ""
    revised_plan: dict[str, Any] | None = None
    user_message: str | None = None
    warnings: list[str] = Field(default_factory=list)

    @field_validator("decision", mode="before")
    @classmethod
    def normalize_decision(cls, value: object) -> str:
        if isinstance(value, dict):
            value = value.get("decision")
        return str(value or "").strip().lower()

    @field_validator("warnings", mode="before")
    @classmethod
    def normalize_warnings(cls, value: object) -> list[str]:
        return normalize_string_list(value)


class PlanJudgeAgent(MultiAgentBase):
    """Review the merged preprocessing plan before it is exposed to the UI."""

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
        system_prompt = plan_judge_prompt
        self.executor = Agent(
            name=name,
            model=model,
            description=description,
            system_prompt=system_prompt,
        )

    def build_task(self) -> str:
        payload = {
            "dataset_id": self.state.dataset_id,
            "target_column": self.state.target_column,
            "merged_plan": self.state.merged_plan,
            "validation_result": self.state.validation_result,
            "judge_retries": self.state.judge_retries,
            "output_contract": {
                "allowed_decisions": ["approve", "revise", "reject"],
                "decision_must_be_plain_string": True,
                "warnings_must_be_list_of_strings": True,
            },
        }
        self._last_payload = payload
        return (
            "STRICT OCKHAM PLAN JUDGE CONTRACT\n\n"
            "You must call the PlanJudgeOutput structured output tool.\n"
            "The decision field must be one plain string: approve, revise or reject.\n"
            "Do not nest decision inside another object.\n"
            "Do not write markdown, commentary, examples or JSON fences outside the tool call.\n\n"
            "INPUT PAYLOAD JSON:\n"
            + json.dumps(payload, ensure_ascii=False, indent=2)
        )

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

        for attempt in range(2):
            try:
                result = await self.executor.invoke_async(task, structured_output_model=PlanJudgeOutput)
                output: PlanJudgeOutput = result.structured_output

                if output.decision not in {"approve", "revise", "reject"}:
                    raise ValueError(
                        "PlanJudgeAgent returned invalid decision "
                        f"'{output.decision}'. Expected one of: approve, revise, reject."
                    )

                self.state.judge_decision = output.decision
                self.state.judge_reason = output.reason
                self.state.judge_user_message = output.user_message

                if output.revised_plan:
                    self.state.merged_plan = output.revised_plan
                    self.state.validation_result = validate_preprocessing_plan(output.revised_plan)

                if output.decision == "approve":
                    self.state.final_plan = self.state.merged_plan
                elif output.decision == "revise":
                    self.state.judge_retries += 1
                else:
                    self.state.judge_decision = "reject"
                break
            except Exception as error:
                logger.warning(
                    "PlanJudgeAgent returned invalid structured output on attempt {}. error={}",
                    attempt + 1,
                    error,
                )
                if attempt == 1:
                    raise
                task = (
                    "YOUR PREVIOUS PLAN JUDGE OUTPUT WAS INVALID.\n"
                    f"Validation error: {error}\n\n"
                    "Call the PlanJudgeOutput structured output tool again.\n"
                    "decision must be exactly one plain string: approve, revise or reject.\n"
                    "warnings must be a list of strings.\n"
                    "Do not nest decision inside an object.\n\n"
                    "ORIGINAL INPUT PAYLOAD JSON:\n"
                    + json.dumps(self._last_payload, ensure_ascii=False, indent=2)
                )

        if result.state == "failed":

            logger.error("Plan judge agent failed to run.")
            raise ValueError(f"Agent {self.executor.name} failed to run")

        logger.debug("Plan judge agent completed successfully.")
        return MultiAgentResult(
            status=Status.COMPLETED,
            results={self.executor.name: NodeResult(result=result)},
        )
